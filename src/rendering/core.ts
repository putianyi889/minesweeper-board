import { cloneMatrix } from '../components/utils'
import { createMouseTracePainter } from './mouseTrace'
import { drawProbabilityCell } from './probability'
import { boardTextureUrls, getBackgroundBoard, getForegroundBoard, getForegroundKey } from './tiles'
import type { BoardTextureKey } from './tiles'
import type { BoardLayerName, BoardRenderInput, RenderFrame, RenderOptions } from './coreTypes'
import type { CanvasSurface, RenderingBackend } from './backend'
import type { DrawingContext } from './drawingContext'
import { BoardRenderError } from './errors'

/** All mutable caches, buffers and request state belong to this instance. */
export class BoardRenderingCore<C extends CanvasSurface, T> {
    private readonly lifetime = new AbortController()
    private readonly textures = new Map<BoardTextureKey, { texture?: T; ready: Promise<T> }>()
    private readonly idle = new Map<BoardLayerName, C>()
    private queue: Promise<unknown> = Promise.resolve()

    constructor(private readonly backend: RenderingBackend<C, T>) {}

    async render(input: BoardRenderInput, options: RenderOptions = {}): Promise<RenderFrame<C | ImageBitmap>> {
        const signal = options.signal
        this.assertAlive(signal)
        const snapshot = snapshotInput(input)
        const output = options.output ?? this.backend.defaultOutput
        if (output !== 'canvas' && output !== 'image-bitmap') {
            throw new BoardRenderError('INVALID_INPUT', `Unknown render output: ${output}`)
        }
        const job = this.queue.then(() => this.draw(snapshot, signal, output))
        this.queue = job.catch(() => undefined)
        return this.wait(job, signal, (frame) => frame.release())
    }

    destroy() {
        if (this.lifetime.signal.aborted) return
        this.lifetime.abort()
        for (const entry of this.textures.values()) {
            if (entry.texture !== undefined) this.backend.disposeTexture(entry.texture)
        }
        this.textures.clear()
        this.backend.destroy()
        for (const canvas of this.idle.values()) disposeCanvas(canvas)
        this.idle.clear()
    }

    private assertAlive(signal?: AbortSignal) {
        if (this.lifetime.signal.aborted) throw new BoardRenderError('DESTROYED', 'The board renderer has been destroyed.')
        if (signal?.aborted) throw new BoardRenderError('CANCELLED', 'The render request was cancelled.', signal.reason)
    }

    private wait<R>(promise: Promise<R>, signal?: AbortSignal, dispose?: (value: R) => void): Promise<R> {
        const lifetime = this.lifetime.signal
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                lifetime.removeEventListener('abort', abort)
                signal?.removeEventListener('abort', abort)
            }
            const abort = () => {
                cleanup()
                try { this.assertAlive(signal) } catch (cause) { reject(cause) }
            }
            lifetime.addEventListener('abort', abort, { once: true })
            signal?.addEventListener('abort', abort, { once: true })
            if (lifetime.aborted || signal?.aborted) abort()
            // Both handlers consume late outcomes, including failures after cancellation.
            void promise.then((value) => {
                cleanup()
                try { this.assertAlive(signal) } catch (cause) {
                    dispose?.(value)
                    reject(cause)
                    return
                }
                resolve(value)
            }, (cause) => {
                cleanup()
                reject(cause)
            })
        })
    }

    private texture(key: BoardTextureKey) {
        this.assertAlive()
        const cached = this.textures.get(key)
        if (cached !== undefined) return cached.ready
        const entry: { texture?: T; ready: Promise<T> } = {
            ready: Promise.resolve().then(() => {
                this.assertAlive()
                return this.backend.loadTexture(key, boardTextureUrls[key], this.lifetime.signal)
            }).then((texture) => {
                try { this.assertAlive() } catch (cause) {
                    this.backend.disposeTexture(texture)
                    throw cause
                }
                entry.texture = texture
                return texture
            }).catch((cause: unknown) => {
                this.textures.delete(key)
                this.assertAlive()
                if (cause instanceof BoardRenderError && cause.code === 'TEXTURE_LOAD_FAILED') throw cause
                throw new BoardRenderError('TEXTURE_LOAD_FAILED', `Failed to load/decode board texture ${key}: ${boardTextureUrls[key]}`, cause)
            }),
        }
        this.textures.set(key, entry)
        return entry.ready
    }

    private acquire(name: BoardLayerName, width: number, height: number) {
        const canvas = this.idle.get(name) ?? this.backend.createCanvas(width, height)
        this.idle.delete(name)
        // Setting the dimensions resets the entire drawing state, including a consumer's previous edits.
        canvas.width = width
        canvas.height = height
        return canvas
    }

    private recycle(name: BoardLayerName, canvas: C) {
        if (this.lifetime.signal.aborted || this.idle.has(name)) disposeCanvas(canvas)
        else this.idle.set(name, canvas)
    }

    private async draw(input: BoardRenderInput, signal: AbortSignal | undefined, output: 'canvas' | 'image-bitmap'): Promise<RenderFrame<C | ImageBitmap>> {
        this.assertAlive(signal)
        const rows = input.board.length
        const columns = input.board.reduce((max, row) => Math.max(max, row.length), 0)
        const width = Math.ceil(columns * input.size)
        const height = Math.ceil(rows * input.size)
        const settings = input.layers ?? {}
        const grids: Partial<Record<BoardLayerName, (BoardTextureKey | undefined)[][]>> = {}
        if (settings.background !== false) {
            const board = typeof settings.background === 'object' && settings.background.board !== undefined
                ? settings.background.board : getBackgroundBoard(input.board)
            grids.background = board.map((row) => row.map((down) => down ? 'down' : 'up'))
        }
        if (settings.foreground !== false) {
            const board = typeof settings.foreground === 'object' && settings.foreground.board !== undefined
                ? settings.foreground.board : getForegroundBoard(input.board)
            grids.foreground = board.map((row) => row.map((cell) => {
                const key = getForegroundKey(cell)
                return key === 'blank' ? undefined : key
            }))
        }
        const keys = new Set<BoardTextureKey>()
        for (const grid of Object.values(grids)) {
            grid.slice(0, rows).forEach((row) => row.slice(0, columns).forEach((url) => {
                if (url !== undefined) keys.add(url)
            }))
        }
        const decoded = new Map(await this.wait(Promise.all([...keys].map(async (key) => [key, await this.texture(key)] as const)), signal))
        this.assertAlive(signal)
        if (output === 'image-bitmap' && (width === 0 || height === 0)) {
            throw new BoardRenderError('BITMAP_UNAVAILABLE', 'ImageBitmap output requires createImageBitmap and a nonempty board.')
        }

        const buffers = new Map<BoardLayerName, C>()
        const sources: Partial<Record<BoardLayerName, C | ImageBitmap>> = {}
        try {
            const drawLayer = (name: BoardLayerName, paint: (context: DrawingContext) => void) => {
                this.assertAlive(signal)
                const canvas = this.acquire(name, width, height)
                buffers.set(name, canvas)
                const context = this.backend.getContext(canvas)
                if (context === null) throw new BoardRenderError('CANVAS_UNAVAILABLE', `Cannot create the ${name} 2D canvas context.`)
                paint(context)
                this.assertAlive(signal)
            }
            for (const [name, grid] of Object.entries(grids)) {
                drawLayer(name as BoardLayerName, (context) => {
                    grid.slice(0, rows).forEach((row, r) => row.slice(0, columns).forEach((url, c) => {
                        if (url !== undefined) this.backend.drawTexture(context, decoded.get(url)!, c * input.size, r * input.size, input.size)
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
                    sources[name] = await this.wait(this.backend.createBitmap(canvas), signal, (bitmap) => bitmap.close())
                }
            }
            this.assertAlive(signal)
        } catch (cause) {
            for (const source of Object.values(sources)) {
                if (output === 'image-bitmap') (source as ImageBitmap).close()
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

function disposeCanvas(canvas: CanvasSurface) {
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
