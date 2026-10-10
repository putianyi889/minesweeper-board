import { shallowMount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BoardBackground from '../../src/components/BoardBackground.vue'
import BoardForeground from '../../src/components/BoardForeground.vue'
import BoardProbability from '../../src/components/BoardProbability.vue'
import MouseTrace from '../../src/components/MouseTrace.vue'
import { minesweeperBoardKey } from '../../src/components/context'
import { createBoardRenderer } from '../../src/rendering/renderer'
import { backgroundImages, foregroundImages } from '../../src/rendering/tiles'
import type { BoardRenderer, LayerRenderHandle } from '../../src/rendering/types'

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (cause: unknown) => void
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
    return { promise, resolve, reject }
}

function makeContext() {
    const fills: string[] = []
    return {
        drawImage: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(function (this: { fillStyle: string }) {
            fills.push(this.fillStyle)
        }), fillText: vi.fn(), fills,
        save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
        moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), rect: vi.fn(), arc: vi.fn(),
        fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '',
        lineWidth: 1, globalAlpha: 1,
    }
}

let contexts: WeakMap<HTMLCanvasElement, ReturnType<typeof makeContext>>
let decoded: ReturnType<typeof deferred<void>>[]
let imageStarted: ReturnType<typeof deferred<void>>
let deferDecode: boolean
let images: FakeImage[]
let renderers: BoardRenderer[]

class FakeImage {
    src = ''
    crossOrigin = ''
    naturalWidth = 160
    naturalHeight = 160
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    decode = vi.fn(() => {
        imageStarted.resolve()
        if (!deferDecode) return Promise.resolve()
        const gate = deferred<void>()
        decoded.push(gate)
        return gate.promise
    })
    constructor() { images.push(this) }
}

function renderer() {
    const instance = createBoardRenderer()
    renderers.push(instance)
    return instance
}

function context(canvas: HTMLCanvasElement) { return contexts.get(canvas)! }

beforeEach(() => {
    contexts = new WeakMap()
    decoded = []
    imageStarted = deferred<void>()
    deferDecode = false
    images = []
    renderers = []
    vi.stubGlobal('Image', FakeImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
        let result = contexts.get(this)
        if (result === undefined) {
            result = makeContext()
            contexts.set(this, result)
        }
        return result as unknown as CanvasRenderingContext2D
    })
})

afterEach(() => {
    renderers.forEach((instance) => instance.destroy())
    decoded.forEach((gate) => gate.resolve())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('independent board renderer', () => {
    it('renders four aligned layers without mounting Vue or painting blank foreground cells', async () => {
        const append = vi.spyOn(document.body, 'appendChild')
        const instance = renderer()
        const frame = await instance.render({
            board: [[10, 1, 11], [12, 16]], size: 16.25,
            layers: {
                probability: { board: [[0.25, 0.9, 0.9], [0.75, 0.9]] },
                mouseTrace: { opacity: 0, events: [
                    { row: 0.5, column: 0.5, state: 'uu', action: 'mv' },
                    { row: 1.5, column: 1.5, state: 'du', action: 'lc' },
                ] },
            },
        })
        expect(append).not.toHaveBeenCalled()
        expect(frame).toMatchObject({ width: 49, height: 33, cellSize: 16.25, released: false })
        expect(Object.keys(frame.layers)).toEqual(['background', 'foreground', 'probability', 'mouseTrace'])
        for (const canvas of Object.values(frame.layers)) expect([canvas.width, canvas.height]).toEqual([49, 33])
        const foreground = context(frame.layers.foreground!)
        expect(foreground.fillRect).not.toHaveBeenCalled()
        expect(foreground.drawImage.mock.calls.map(([image]) => (image as FakeImage).src))
            .toEqual([foregroundImages.num1, foregroundImages.flag, foregroundImages.mine])
        expect(foreground.drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 16.25, 0, 16.25, 16.25)
        const probability = context(frame.layers.probability!)
        expect(probability.fillText.mock.calls).toEqual([['25', 8.125, 8.125], ['75', 8.125, 24.375]])
        const trace = context(frame.layers.mouseTrace!)
        expect(trace.fills).toEqual(['rgba(0, 0, 0, 0)'])
        expect(trace.moveTo).toHaveBeenCalledWith(8.125, 8.125)
        expect(trace.lineTo).toHaveBeenCalledWith(24.375, 24.375)
        frame.release()
    })

    it('waits for decoding and snapshots both active and queued inputs', async () => {
        deferDecode = true
        const instance = renderer()
        const board = [[10]]
        const firstPromise = instance.render({ board, size: 10, layers: { foreground: false } })
        let completed = false
        void firstPromise.then(() => { completed = true })
        await imageStarted.promise
        board[0]![0] = 0
        const nextInput = { board: [[0]], size: 20, layers: { foreground: false } }
        const secondPromise = instance.render(nextInput)
        nextInput.board[0]![0] = 10
        nextInput.size = 30
        expect(completed).toBe(false)
        expect(images[0]!.src).toBe(backgroundImages.up)
        expect(images[0]!.crossOrigin).toBe('anonymous')
        deferDecode = false
        decoded.forEach((gate) => gate.resolve())
        const first = await firstPromise
        const second = await secondPromise
        expect(first.cellSize).toBe(10)
        expect(second.cellSize).toBe(20)
        expect(context(second.layers.background!).drawImage.mock.calls[0]![0].src).toBe(backgroundImages.down)
        first.release()
        second.release()
    })

    it('reuses decoded textures and released buffers but never overwrites a retained canvas', async () => {
        const instance = renderer()
        const input = { board: [[10]], size: 16, layers: { foreground: false } }
        const first = await instance.render(input)
        const canvas = first.layers.background!
        const drawCalls = context(canvas).drawImage.mock.calls.length
        const second = await instance.render({ ...input, size: 32 })
        expect(second.layers.background).not.toBe(canvas)
        expect(canvas.width).toBe(16)
        expect(context(canvas).drawImage).toHaveBeenCalledTimes(drawCalls)
        expect(images).toHaveLength(1)
        first.release()
        first.release()
        expect(first.released).toBe(true)
        second.release()
        const third = await instance.render(input)
        expect(third.layers.background).toBe(canvas)
        instance.destroy()
        expect(canvas.width).toBe(16)
        third.release()
        expect(canvas.width).toBe(0)
    })

    it('snapshots nested marker settings and mouse events while decoding other layers', async () => {
        deferDecode = true
        const instance = renderer()
        const trace = {
            opacity: 0,
            events: [{ row: 0.5, column: 0.5, state: 'du' as const, action: 'lc' as const }],
            markers: { lc: { fill: '#123456', size: 0.5 } },
        }
        const pending = instance.render({ board: [[10]], size: 16, layers: { mouseTrace: trace } })
        await imageStarted.promise
        trace.events[0]!.column = 3
        trace.markers.lc.fill = '#abcdef'
        trace.markers.lc.size = 2
        trace.opacity = 1
        decoded.forEach((gate) => gate.resolve())
        const frame = await pending
        const painter = context(frame.layers.mouseTrace!)
        expect(painter.fills).toEqual(['rgba(0, 0, 0, 0)'])
        expect(painter.arc).toHaveBeenCalledWith(8, 8, 4, 0, Math.PI * 2)
        expect(painter.fillStyle).toBe('#123456')
        frame.release()
    })

    it('supports explicit layer overrides and disabling all layers', async () => {
        const instance = renderer()
        const frame = await instance.render({ board: [[10]], size: 16, layers: {
            background: { board: [[true]] }, foreground: { board: [[-4]] },
        } })
        expect(context(frame.layers.background!).drawImage.mock.calls[0]![0].src).toBe(backgroundImages.down)
        expect(context(frame.layers.foreground!).drawImage.mock.calls[0]![0].src).toBe(foregroundImages.blast)
        frame.release()
        const empty = await instance.render({ board: [], size: 16, layers: { background: false, foreground: false } })
        expect(empty).toMatchObject({ width: 0, height: 0, layers: {} })
        empty.release()
    })

    it.each([false, true])('uses load/error events when decode is unavailable (failure=%s)', async (fail) => {
        vi.stubGlobal('Image', class {
            naturalWidth = 160
            naturalHeight = 160
            crossOrigin = ''
            onload: (() => void) | null = null
            onerror: (() => void) | null = null
            set src(value: string) {
                if (value) queueMicrotask(() => { if (fail) this.onerror?.(); else this.onload?.() })
            }
        })
        const pending = renderer().render({ board: [[10]], size: 16 })
        if (fail) await expect(pending).rejects.toMatchObject({ code: 'TEXTURE_LOAD_FAILED' })
        else (await pending).release()
    })

    it('rejects an entire frame on decode failure and allows a later retry', async () => {
        deferDecode = true
        const instance = renderer()
        const input = { board: [[10, 1]], size: 16 }
        const pending = instance.render(input)
        const failed = expect(pending).rejects.toMatchObject({ code: 'TEXTURE_LOAD_FAILED' })
        await imageStarted.promise
        decoded[0]!.reject(new Error('corrupt texture'))
        decoded.slice(1).forEach((gate) => gate.resolve())
        await failed
        deferDecode = false
        const frame = await instance.render(input)
        expect(frame.layers.background).toBeDefined()
        expect(frame.layers.foreground).toBeDefined()
        frame.release()
    })

    it('rejects on a missing 2D context or a failed drawing callback', async () => {
        const instance = renderer()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
        getContext.mockReturnValueOnce(null)
        await expect(instance.render({ board: [[10]], size: 16 }))
            .rejects.toMatchObject({ code: 'CANVAS_UNAVAILABLE' })
        await expect(instance.render({ board: [[10]], size: 16, layers: {
            probability: { board: [[0.5]], color: () => { throw new Error('bad color') } },
        } })).rejects.toMatchObject({ code: 'DRAW_FAILED', cause: { message: 'bad color' } })
        const frame = await instance.render({ board: [[10]], size: 16 })
        frame.release()
    })

    it('rejects active, queued and future requests immediately on destroy', async () => {
        deferDecode = true
        const instance = renderer()
        const input = { board: [[10]], size: 16 }
        const pending = instance.render(input)
        const queued = instance.render(input)
        const pendingRejected = expect(pending).rejects.toMatchObject({ code: 'DESTROYED' })
        const queuedRejected = expect(queued).rejects.toMatchObject({ code: 'DESTROYED' })
        await imageStarted.promise
        instance.destroy()
        instance.destroy()
        await Promise.all([pendingRejected, queuedRejected])
        await expect(instance.render(input)).rejects.toMatchObject({ code: 'DESTROYED' })
        expect(images[0]!.src).toBe('')
    })

    it('owns bitmap outputs until release, including after renderer destruction', async () => {
        const bitmaps: { width: number; height: number; close: ReturnType<typeof vi.fn> }[] = []
        vi.stubGlobal('createImageBitmap', vi.fn(async (canvas: HTMLCanvasElement) => {
            const bitmap = { width: canvas.width, height: canvas.height, close: vi.fn() }
            bitmaps.push(bitmap)
            return bitmap
        }))
        const instance = renderer()
        const frame = await instance.render({ board: [[1]], size: 16 }, { output: 'image-bitmap' })
        expect(bitmaps).toHaveLength(2)
        expect(frame.layers.foreground).toBe(bitmaps[1])
        instance.destroy()
        bitmaps.forEach((bitmap) => expect(bitmap.close).not.toHaveBeenCalled())
        frame.release()
        frame.release()
        bitmaps.forEach((bitmap) => expect(bitmap.close).toHaveBeenCalledTimes(1))
    })

    it('closes partial bitmap results if converting a later layer fails', async () => {
        const bitmap = { close: vi.fn() }
        vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValueOnce(bitmap).mockRejectedValueOnce(new Error('conversion failed')))
        await expect(renderer().render({ board: [[1]], size: 16 }, { output: 'image-bitmap' }))
            .rejects.toMatchObject({ code: 'DRAW_FAILED' })
        expect(bitmap.close).toHaveBeenCalledTimes(1)
    })

    it('closes a bitmap that finishes converting after destruction', async () => {
        const bitmap = { close: vi.fn() }
        const converting = deferred<ImageBitmap>()
        const started = deferred<void>()
        vi.stubGlobal('createImageBitmap', vi.fn(() => { started.resolve(); return converting.promise }))
        const instance = renderer()
        const pending = instance.render({ board: [[1]], size: 16 }, { output: 'image-bitmap' })
        const rejected = expect(pending).rejects.toMatchObject({ code: 'DESTROYED' })
        await started.promise
        instance.destroy()
        await rejected
        converting.resolve(bitmap as unknown as ImageBitmap)
        await converting.promise
        expect(bitmap.close).toHaveBeenCalledTimes(1)
    })

    it('fails explicitly when bitmap support is unavailable', async () => {
        vi.stubGlobal('createImageBitmap', undefined)
        await expect(renderer().render({ board: [[1]], size: 16 }, { output: 'image-bitmap' }))
            .rejects.toMatchObject({ code: 'BITMAP_UNAVAILABLE' })
    })

    it.each([0, -1, NaN, Infinity])('rejects invalid cell size %s', async (size) => {
        await expect(renderer().render({ board: [[10]], size })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    })
})

describe('component layer outputs', () => {
    const provide = () => ({ [minesweeperBoardKey as symbol]: {
        board: computed(() => [[10, 10]]), size: computed(() => 16.25),
    } })
    const mounts = [
        { name: 'background', mount: () => shallowMount(BoardBackground, { global: { provide: provide() } }) },
        { name: 'foreground', mount: () => shallowMount(BoardForeground, { props: { board: [[1, -2]] }, global: { provide: provide() } }) },
        { name: 'probability', mount: () => shallowMount(BoardProbability, { props: { board: [[0.1]] }, global: { provide: provide() } }) },
        { name: 'mouseTrace', mount: () => shallowMount(MouseTrace, { props: { events: [] }, global: { provide: provide() } }) },
    ]
    it.each(mounts)('exposes a completed detached $name canvas and actual cell size', async ({ mount }) => {
        const wrapper = mount()
        const handle = wrapper.vm as unknown as LayerRenderHandle
        expect(handle.cellSize).toBe(16.25)
        const frame = await handle.render()
        expect(frame).toMatchObject({ width: 33, height: 17, cellSize: 16.25 })
        expect(wrapper.element.contains(frame.source)).toBe(false)
        wrapper.unmount()
        expect(frame.source.width).toBe(33)
        frame.release()
        expect(frame.source.width).toBe(0)
        await expect(handle.render()).rejects.toMatchObject({ code: 'DESTROYED' })
    })

    it('uses the current auto-sized context after Vue flush and rejects pending renders on unmount', async () => {
        deferDecode = true
        const size = ref(16)
        const wrapper = shallowMount(BoardBackground, { global: { provide: {
            [minesweeperBoardKey as symbol]: { board: computed(() => [[10]]), size: computed(() => size.value) },
        } } })
        const handle = wrapper.vm as unknown as LayerRenderHandle
        size.value = 23.5
        const pending = handle.render()
        const rejected = expect(pending).rejects.toMatchObject({ code: 'DESTROYED' })
        await imageStarted.promise
        expect(handle.cellSize).toBe(23.5)
        wrapper.unmount()
        await rejected
    })
})
