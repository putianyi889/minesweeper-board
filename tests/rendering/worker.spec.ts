// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBoardRenderer, boardTextureUrls } from '../../src/worker'
import type { WorkerBoardRenderer } from '../../src/worker'

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (cause: unknown) => void
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
    return { promise, resolve, reject }
}

class Bitmap {
    width = 160
    height = 160
    close = vi.fn(() => { this.width = 0; this.height = 0 })
    constructor(readonly label = '', readonly commands: unknown[][] = []) {}
}

class Canvas {
    static instances: Canvas[] = []
    readonly commands: unknown[][] = []
    readonly context = {
        drawImage: (image: Bitmap, ...args: number[]) => { this.commands.push(['image', image.label, ...args]) },
        clearRect: (...args: number[]) => { this.commands.push(['clear', ...args]) },
        fillText: (...args: unknown[]) => { this.commands.push(['text', ...args]) },
        fillRect: (...args: number[]) => { this.commands.push(['fill', this.context.fillStyle, ...args]) },
        moveTo: (...args: number[]) => { this.commands.push(['move', ...args]) },
        lineTo: (...args: number[]) => { this.commands.push(['line', ...args]) },
        arc: (...args: number[]) => { this.commands.push(['arc', ...args]) },
        save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
        stroke: vi.fn(), fill: vi.fn(), rect: vi.fn(), fillStyle: '', strokeStyle: '', font: '',
    }
    getContext = vi.fn(() => this.context)
    transferToImageBitmap = vi.fn(() => {
        const bitmap = new Bitmap('frame', this.commands.slice())
        bitmap.width = this.width
        bitmap.height = this.height
        this.commands.length = 0
        return bitmap as unknown as ImageBitmap
    })
    constructor(public width: number, public height: number) { Canvas.instances.push(this) }
}

let renderers: WorkerBoardRenderer[]
const bitmap = (label = '') => new Bitmap(label) as unknown as ImageBitmap
const input = { board: [[10, 1, 11], [12, 16]], size: 16.25 }

function renderer(options: Parameters<typeof createBoardRenderer>[0] = {}) {
    const instance = createBoardRenderer(options)
    renderers.push(instance)
    return instance
}

beforeEach(() => {
    renderers = []
    Canvas.instances = []
    vi.stubGlobal('OffscreenCanvas', Canvas)
    // Poison all DOM constructors/globals, including indirect initialization accesses.
    for (const name of ['window', 'document', 'HTMLCanvasElement', 'HTMLImageElement', 'Image']) {
        vi.stubGlobal(name, undefined)
    }
})

afterEach(() => {
    renderers.forEach((instance) => instance.destroy())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('Worker renderer without DOM', () => {
    it('imports and creates with no DOM globals and produces four aligned bitmap layers', async () => {
        const worker = await import('../../src/worker')
        expect(worker.createBoardRenderer).toBe(createBoardRenderer)
        const loadTexture = vi.fn(async (key: string) => bitmap(key))
        const instance = renderer({ loadTexture })
        const frame = await instance.render({ ...input, layers: {
            probability: { board: [[0.25, 0.5, 0.9], [0.75, 0.1]], color: () => '#123456' },
            mouseTrace: { opacity: 0, lineWidth: 0.1, startIndex: 1, events: [
                { row: 0.5, column: 0.5, action: 'mv', state: 'uu' },
                { row: 1.5, column: 0.5, action: 'mv', state: 'du' },
                { row: 1.5, column: 1.5, action: 'lc', state: 'du' },
            ] },
        } })
        expect(frame).toMatchObject({ width: 49, height: 33, cellSize: 16.25 })
        for (const source of Object.values(frame.layers)) expect([source.width, source.height]).toEqual([49, 33])
        const foreground = frame.layers.foreground as unknown as Bitmap
        expect(foreground.commands).toEqual([
            ['image', 'num1', 16.25, 0, 16.25, 16.25],
            ['image', 'flag', 32.5, 0, 16.25, 16.25],
            ['image', 'mine', 16.25, 16.25, 16.25, 16.25],
        ])
        const probability = frame.layers.probability as unknown as Bitmap
        expect(probability.commands.filter(([name]) => name === 'text'))
            .toEqual([['text', '25', 8.125, 8.125], ['text', '75', 8.125, 24.375]])
        const trace = frame.layers.mouseTrace as unknown as Bitmap
        expect(trace.commands).toContainEqual(['fill', 'rgba(0, 0, 0, 0)', 0, 0, 49, 33])
        expect(trace.commands).toContainEqual(['move', 8.125, 24.375])
        expect(trace.commands).not.toContainEqual(['move', 8.125, 8.125])
        expect(trace.commands).toContainEqual(['line', 24.375, 24.375])
        await instance.render(input).then((next) => next.release())
        expect(loadTexture).toHaveBeenCalledTimes(5)
        expect(Canvas.instances).toHaveLength(4)
        frame.release()
    })

    it('leases OffscreenCanvas outputs without overwriting a retained frame', async () => {
        const instance = renderer({ loadTexture: async (key) => bitmap(key) })
        const first = await instance.render(input, { output: 'canvas' })
        const source = first.layers.background!
        const second = await instance.render({ ...input, size: 32 }, { output: 'canvas' })
        expect(source).not.toBe(second.layers.background)
        expect(source.width).toBe(49)
        first.release()
        second.release()
        const third = await instance.render(input, { output: 'canvas' })
        expect(third.layers.background).toBe(source)
        instance.destroy()
        expect(source.width).toBe(49)
        third.release()
        expect(source.width).toBe(0)
    })

    it('takes ownership of injected used and unused textures, leaving returned frames alive until release', async () => {
        const up = bitmap('up')
        const unused = bitmap('blast')
        const textures = { up, blast: unused }
        const loader = vi.fn(async (key: string) => bitmap(key))
        const instance = renderer({ textures, loadTexture: loader })
        textures.up = bitmap('replacement')
        const frame = await instance.render({ board: [[10]], size: 16, layers: { foreground: false } })
        expect(loader).not.toHaveBeenCalled()
        const output = frame.layers.background!
        instance.destroy()
        expect(up.close).toHaveBeenCalledTimes(1)
        expect(unused.close).toHaveBeenCalledTimes(1)
        expect(output.close).not.toHaveBeenCalled()
        frame.release()
        frame.release()
        expect(output.close).toHaveBeenCalledTimes(1)
    })

    it('does not share texture caches or buffers between instances', async () => {
        const firstLoader = vi.fn(async () => bitmap('first'))
        const secondLoader = vi.fn(async () => bitmap('second'))
        const first = renderer({ loadTexture: firstLoader })
        const second = renderer({ loadTexture: secondLoader })
        const small = { board: [[10]], size: 16, layers: { foreground: false } }
        const a = await first.render(small)
        const b = await second.render(small)
        expect(a.layers.background).not.toBe(b.layers.background)
        expect(firstLoader).toHaveBeenCalledTimes(1)
        expect(secondLoader).toHaveBeenCalledTimes(1)
        first.destroy()
        const c = await second.render(small)
        expect(secondLoader).toHaveBeenCalledTimes(1)
        a.release(); b.release(); c.release()
    })

    it('resolves texture URLs against an explicit deployment base and fetches/decodes each once', async () => {
        const response = { ok: true, blob: vi.fn(async () => new Blob(['PNG'])) }
        const fetcher = vi.fn(async () => response)
        const decoder = vi.fn(async () => bitmap('png'))
        vi.stubGlobal('fetch', fetcher)
        vi.stubGlobal('createImageBitmap', decoder)
        const instance = renderer({ textureUrls: { up: './tiles/up.png' }, assetBaseURL: 'https://example.test/export/' })
        const small = { board: [[10]], size: 16, layers: { foreground: false } }
        const first = await instance.render(small)
        const second = await instance.render(small)
        expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://example.test/export/tiles/up.png', {
            signal: expect.any(AbortSignal), mode: 'cors', credentials: 'same-origin',
        })
        expect(decoder).toHaveBeenCalledTimes(1)
        first.release(); second.release()
    })

    it.each(['HTTP', 'decode'])('rejects the complete frame on %s failure and permits retry', async (failure) => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: failure !== 'HTTP', status: 404, blob: async () => new Blob() })))
        vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('unsupported SVG decoder') }))
        const instance = renderer()
        const small = { board: [[10]], size: 16 }
        await expect(instance.render(small)).rejects.toMatchObject({ code: 'TEXTURE_LOAD_FAILED' })
        expect(Canvas.instances).toHaveLength(0)
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob() })))
        vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap()))
        const frame = await instance.render(small)
        frame.release()
    })

    it('cancels active and queued requests while keeping reusable texture loads and subsequent renders valid', async () => {
        const loading = deferred<ImageBitmap>()
        const started = deferred<void>()
        const loader = vi.fn(() => { started.resolve(); return loading.promise })
        const instance = renderer({ loadTexture: loader })
        const small = { board: [[10]], size: 16, layers: { foreground: false } }
        const active = new AbortController()
        const queued = new AbortController()
        const first = instance.render(small, { signal: active.signal })
        const second = instance.render(small, { signal: queued.signal })
        const firstRejected = expect(first).rejects.toMatchObject({ code: 'CANCELLED' })
        const secondRejected = expect(second).rejects.toMatchObject({ code: 'CANCELLED' })
        await started.promise
        queued.abort()
        active.abort()
        await Promise.all([firstRejected, secondRejected])
        const third = instance.render(small)
        loading.resolve(bitmap('up'))
        const frame = await third
        expect(loader).toHaveBeenCalledTimes(1)
        expect(Canvas.instances).toHaveLength(1)
        frame.release()
    })

    it('rejects immediately on destruction and closes a decoder result arriving later', async () => {
        const loading = deferred<ImageBitmap>()
        const started = deferred<void>()
        const instance = renderer({ loadTexture: (_key, _url, signal) => {
            expect(signal.aborted).toBe(false)
            started.resolve()
            return loading.promise
        } })
        const small = { board: [[10]], size: 16 }
        const pending = instance.render(small)
        const rejected = expect(pending).rejects.toMatchObject({ code: 'DESTROYED' })
        await started.promise
        instance.destroy()
        await rejected
        const late = bitmap()
        loading.resolve(late)
        await expect(instance.render(small)).rejects.toMatchObject({ code: 'DESTROYED' })
        expect(late.close).toHaveBeenCalledTimes(1)
    })

    it('closes already converted bitmaps when a later conversion fails', async () => {
        const converted = bitmap()
        const instance = renderer({ loadTexture: async (key) => bitmap(key) })
        // Replace constructor to install predictable conversion behavior per buffer.
        let count = 0
        vi.stubGlobal('OffscreenCanvas', class extends Canvas {
            constructor(width: number, height: number) {
                super(width, height)
                this.transferToImageBitmap = vi.fn(() => {
                    if (++count === 2) throw new Error('conversion failed')
                    return converted
                })
            }
        })
        await expect(instance.render({ board: [[1]], size: 16 })).rejects.toMatchObject({ code: 'DRAW_FAILED' })
        expect(converted.close).toHaveBeenCalledTimes(1)
    })

    it('reports missing capabilities and invalid texture ownership explicitly', () => {
        vi.stubGlobal('OffscreenCanvas', undefined)
        expect(() => createBoardRenderer()).toThrow(expect.objectContaining({ code: 'CANVAS_UNAVAILABLE' }))
        vi.stubGlobal('OffscreenCanvas', Canvas)
        const shared = bitmap()
        expect(() => createBoardRenderer({ textures: { up: shared, down: shared } }))
            .toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }))
        expect(shared.close).not.toHaveBeenCalled()
        expect(() => createBoardRenderer({ assetBaseURL: 'relative/path' }))
            .toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }))
        expect(boardTextureUrls.up).toBeDefined()
    })
})
