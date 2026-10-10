import { cloneMatrix } from '../components/utils'
import { createMouseTracePainter } from './mouseTrace'
import { drawProbabilityCell } from './probability'
import { backgroundImages, foregroundImages, getBackgroundBoard, getForegroundBoard, getForegroundKey } from './tiles'
import type { BoardLayerName, BoardRenderFrame, BoardRenderInput, BoardRenderer, RenderOptions, RenderSource } from './types'

export type BoardRenderErrorCode = 'DESTROYED' | 'INVALID_INPUT' | 'TEXTURE_LOAD_FAILED' |
    'CANVAS_UNAVAILABLE' | 'BITMAP_UNAVAILABLE' | 'DRAW_FAILED'

export class BoardRenderError extends Error {
    constructor(public readonly code: BoardRenderErrorCode, message: string, cause?: unknown) {
        super(message, { cause })
        this.name = 'BoardRenderError'
    }
}

function destroyedError() {
    return new BoardRenderError('DESTROYED', 'The board renderer has been destroyed.')
}

/** Creates a reusable browser renderer. No Vue mount, layout, DOM capture, or animation frame is required. */
export function createBoardRenderer(): BoardRenderer {
    return new CanvasBoardRenderer()
}

class CanvasBoardRenderer implements BoardRenderer {
    private readonly lifetime = new AbortController()
    private readonly textures = new Map<string, { image: HTMLImageElement; ready: Promise<HTMLImageElement> }>()
    private readonly idle = new Map<BoardLayerName, HTMLCanvasElement>()
    private queue: Promise<unknown> = Promise.resolve()

    render(input: BoardRenderInput, options?: { output?: 'canvas' }): Promise<BoardRenderFrame<HTMLCanvasElement>>
    render(input: BoardRenderInput, options: { output: 'image-bitmap' }): Promise<BoardRenderFrame<ImageBitmap>>
    render(input: BoardRenderInput, options: RenderOptions): Promise<BoardRenderFrame>
    async render(input: BoardRenderInput, options: RenderOptions = {}): Promise<BoardRenderFrame> {
        this.assertAlive()
        // Snapshot at invocation, before any decode/queue await. Later mutations belong to another request.
        const snapshot = snapshotInput(input)
        const output = options.output ?? 'canvas'
        if (output !== 'canvas' && output !== 'image-bitmap') {
            throw new BoardRenderError('INVALID_INPUT', `Unknown render output: ${output}`)
        }
        const job = this.queue.then(() => this.draw(snapshot, output))
        this.queue = job.catch(() => undefined)
        return this.wait(job, (frame) => frame.release())
    }

    destroy() {
        if (this.lifetime.signal.aborted) return
        this.lifetime.abort()
        for (const { image } of this.textures.values()) {
            image.onload = null
            image.onerror = null
            image.src = ''
        }
        this.textures.clear()
        for (const canvas of this.idle.values()) disposeCanvas(canvas)
        this.idle.clear()
    }

    private assertAlive() {
        if (this.lifetime.signal.aborted) throw destroyedError()
    }

    private wait<T>(promise: Promise<T>, dispose?: (value: T) => void): Promise<T> {
        const signal = this.lifetime.signal
        return new Promise((resolve, reject) => {
            const abort = () => reject(destroyedError())
            if (signal.aborted) abort()
            else signal.addEventListener('abort', abort, { once: true })
            promise.then((value) => {
                if (signal.aborted) {
                    dispose?.(value)
                    abort()
                } else resolve(value)
            }, reject).finally(() => signal.removeEventListener('abort', abort))
        })
    }

    private texture(url: string) {
        this.assertAlive()
        const cached = this.textures.get(url)
        if (cached !== undefined) return cached.ready
        const image = new Image()
        image.crossOrigin = 'anonymous'
        const ready = (async () => {
            try {
                if (typeof image.decode === 'function') {
                    image.src = url
                    await image.decode()
                } else {
                    await new Promise<void>((resolve, reject) => {
                        image.onload = () => resolve()
                        image.onerror = () => reject(new Error(`Failed to load ${url}`))
                        image.src = url
                    })
                }
                this.assertAlive()
                if (image.naturalWidth === 0 || image.naturalHeight === 0) {
                    throw new Error('The decoded image has no pixels.')
                }
                return image
            } catch (cause) {
                this.textures.delete(url)
                if (this.lifetime.signal.aborted) throw destroyedError()
                throw new BoardRenderError('TEXTURE_LOAD_FAILED', `Failed to load/decode board texture: ${url}`, cause)
            } finally {
                image.onload = null
                image.onerror = null
            }
        })()
        this.textures.set(url, { image, ready })
        return ready
    }

    private acquire(name: BoardLayerName, width: number, height: number) {
        const canvas = this.idle.get(name) ?? document.createElement('canvas')
        this.idle.delete(name)
        // Setting the dimensions resets the entire drawing state, including a consumer's previous edits.
        canvas.width = width
        canvas.height = height
        return canvas
    }

    private recycle(name: BoardLayerName, canvas: HTMLCanvasElement) {
        if (this.lifetime.signal.aborted || this.idle.has(name)) disposeCanvas(canvas)
        else this.idle.set(name, canvas)
    }

    private async draw(input: BoardRenderInput, output: 'canvas' | 'image-bitmap'): Promise<BoardRenderFrame> {
        this.assertAlive()
        const rows = input.board.length
        const columns = input.board.reduce((max, row) => Math.max(max, row.length), 0)
        const width = Math.ceil(columns * input.size)
        const height = Math.ceil(rows * input.size)
        const settings = input.layers ?? {}
        const grids: Partial<Record<BoardLayerName, (string | undefined)[][]>> = {}
        if (settings.background !== false) {
            const board = typeof settings.background === 'object' && settings.background.board !== undefined
                ? settings.background.board : getBackgroundBoard(input.board)
            grids.background = board.map((row) => row.map((down) => backgroundImages[down ? 'down' : 'up']))
        }
        if (settings.foreground !== false) {
            const board = typeof settings.foreground === 'object' && settings.foreground.board !== undefined
                ? settings.foreground.board : getForegroundBoard(input.board)
            grids.foreground = board.map((row) => row.map((cell) => {
                const key = getForegroundKey(cell)
                return key === 'blank' ? undefined : foregroundImages[key]
            }))
        }
        const urls = new Set<string>()
        for (const grid of Object.values(grids)) {
            grid.slice(0, rows).forEach((row) => row.slice(0, columns).forEach((url) => {
                if (url !== undefined) urls.add(url)
            }))
        }
        const decoded = new Map(await this.wait(Promise.all([...urls].map(async (url) => [url, await this.texture(url)] as const))))
        this.assertAlive()
        if (output === 'image-bitmap' && (typeof createImageBitmap !== 'function' || width === 0 || height === 0)) {
            throw new BoardRenderError('BITMAP_UNAVAILABLE', 'ImageBitmap output requires createImageBitmap and a nonempty board.')
        }

        const buffers = new Map<BoardLayerName, HTMLCanvasElement>()
        const sources: Partial<Record<BoardLayerName, RenderSource>> = {}
        try {
            const drawLayer = (name: BoardLayerName, paint: (context: CanvasRenderingContext2D) => void) => {
                const canvas = this.acquire(name, width, height)
                buffers.set(name, canvas)
                const context = canvas.getContext('2d')
                if (context === null) throw new BoardRenderError('CANVAS_UNAVAILABLE', `Cannot create the ${name} 2D canvas context.`)
                paint(context)
            }
            for (const [name, grid] of Object.entries(grids)) {
                drawLayer(name as BoardLayerName, (context) => {
                    grid.slice(0, rows).forEach((row, r) => row.slice(0, columns).forEach((url, c) => {
                        if (url !== undefined) context.drawImage(decoded.get(url)!, c * input.size, r * input.size, input.size, input.size)
                    }))
                })
            }
            const probability = settings.probability
            if (probability) {
                drawLayer('probability', (context) => {
                    probability.board.slice(0, rows).forEach((row, r) => row.slice(0, columns).forEach((value, c) => {
                        drawProbabilityCell(context, value, r, c, input.size, input.board, probability.color)
                    }))
                })
            }
            const trace = settings.mouseTrace
            if (trace) {
                drawLayer('mouseTrace', (context) => {
                    const painter = createMouseTracePainter(trace, input.size)
                    painter.fillBackground(context, { x: 0, y: 0, width, height })
                    painter.drawRange(context, 0, trace.events.length)
                })
            }
            for (const [name, canvas] of buffers) {
                if (output === 'canvas') sources[name] = canvas
                else {
                    sources[name] = await this.wait(createImageBitmap(canvas).then((bitmap) => {
                        if (this.lifetime.signal.aborted) {
                            bitmap.close()
                            throw destroyedError()
                        }
                        return bitmap
                    }))
                }
            }
            this.assertAlive()
        } catch (cause) {
            for (const source of Object.values(sources)) {
                if (!isCanvas(source)) source.close()
            }
            for (const [name, canvas] of buffers) this.recycle(name, canvas)
            if (cause instanceof BoardRenderError) throw cause
            throw new BoardRenderError('DRAW_FAILED', 'Failed to render the complete board frame.', cause)
        }

        if (output === 'image-bitmap') {
            for (const [name, canvas] of buffers) this.recycle(name, canvas)
        }
        let released = false
        return Object.freeze({
            width, height, cellSize: input.size,
            layers: Object.freeze(sources),
            get released() { return released },
            release: () => {
                if (released) return
                released = true
                if (output === 'canvas') {
                    for (const [name, canvas] of buffers) this.recycle(name, canvas)
                } else {
                    for (const source of Object.values(sources)) (source as ImageBitmap).close()
                }
            },
        })
    }
}

function isCanvas(source: RenderSource): source is HTMLCanvasElement {
    return 'getContext' in source
}

function disposeCanvas(canvas: HTMLCanvasElement) {
    canvas.width = 0
    canvas.height = 0
}

function snapshotInput(input: BoardRenderInput): BoardRenderInput {
    if (!Number.isFinite(input.size) || input.size <= 0) {
        throw new BoardRenderError('INVALID_INPUT', 'Cell size must be a positive finite number.')
    }
    const board = cloneMatrix(input.board)
    const width = Math.ceil(board.reduce((max, row) => Math.max(max, row.length), 0) * input.size)
    const height = Math.ceil(board.length * input.size)
    if (![width, height].every((value) => Number.isSafeInteger(value) && value <= 0xffffffff)) {
        throw new BoardRenderError('INVALID_INPUT', 'Board bitmap dimensions exceed the canvas dimension range.')
    }
    const layers = input.layers ?? {}
    const trace = layers.mouseTrace
    return {
        board, size: input.size,
        layers: {
            background: typeof layers.background === 'object'
                ? { board: layers.background.board === undefined ? undefined : cloneMatrix(layers.background.board) } : layers.background,
            foreground: typeof layers.foreground === 'object'
                ? { board: layers.foreground.board === undefined ? undefined : cloneMatrix(layers.foreground.board) } : layers.foreground,
            probability: layers.probability ? { ...layers.probability, board: cloneMatrix(layers.probability.board) } : false,
            mouseTrace: trace ? {
                ...trace,
                events: trace.events.map((event) => ({ ...event })),
                color: { ...trace.color },
                markers: Object.fromEntries(Object.entries(trace.markers ?? {}).map(([action, marker]) =>
                    [action, marker === false ? false : { ...marker }])),
            } : false,
        },
    }
}
