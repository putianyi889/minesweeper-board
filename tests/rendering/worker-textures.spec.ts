import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadWorkerBoardTextures } from '../../src/rendering/loadWorkerTextures'

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((yes) => { resolve = yes })
    return { promise, resolve }
}

const texture = () => ({ width: 160, height: 160, close: vi.fn() })
let drawImage: ReturnType<typeof vi.fn>
let images: { src: string }[]

beforeEach(() => {
    images = []
    drawImage = vi.fn()
    vi.stubGlobal('Image', class {
        src = ''
        naturalWidth = 160
        naturalHeight = 160
        crossOrigin = ''
        onload = null
        onerror = null
        decode = vi.fn(async () => {})
        constructor() { images.push(this) }
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
})

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('main-thread Worker texture preparation', () => {
    it('decodes and rasterizes requested textures once at the chosen resolution without mounting anything', async () => {
        const decode = vi.fn(async () => texture())
        const append = vi.spyOn(document.body, 'appendChild')
        vi.stubGlobal('createImageBitmap', decode)
        const result = await loadWorkerBoardTextures({ keys: ['up', 'num1', 'up'], size: 256 })
        expect(Object.keys(result)).toEqual(['up', 'num1'])
        expect(images).toHaveLength(2)
        expect(images.every((image) => image.src === '')).toBe(true)
        expect(drawImage).toHaveBeenCalledTimes(2)
        expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 256, 256)
        expect(decode).toHaveBeenCalledTimes(2)
        expect(append).not.toHaveBeenCalled()
        Object.values(result).forEach((source) => source.close())
    })

    it('closes completed and late bitmaps if another texture fails', async () => {
        const done = texture()
        const late = texture()
        const pending = deferred<ImageBitmap>()
        const decoder = vi.fn().mockResolvedValueOnce(done).mockRejectedValueOnce(new Error('decode failed')).mockReturnValueOnce(pending.promise)
        vi.stubGlobal('createImageBitmap', decoder)
        await expect(loadWorkerBoardTextures({ keys: ['up', 'down', 'num1'] })).rejects.toMatchObject({ code: 'TEXTURE_LOAD_FAILED' })
        expect(done.close).toHaveBeenCalledTimes(1)
        pending.resolve(late as unknown as ImageBitmap)
        await pending.promise
        expect(late.close).toHaveBeenCalledTimes(1)
    })

    it('cancels immediately during bitmap creation and closes the late result', async () => {
        const source = texture()
        const pending = deferred<ImageBitmap>()
        const started = deferred<void>()
        vi.stubGlobal('createImageBitmap', vi.fn(() => { started.resolve(); return pending.promise }))
        const controller = new AbortController()
        const preparing = loadWorkerBoardTextures({ keys: ['up'], signal: controller.signal })
        const rejected = expect(preparing).rejects.toMatchObject({ code: 'CANCELLED' })
        await started.promise
        controller.abort()
        await rejected
        pending.resolve(source as unknown as ImageBitmap)
        await pending.promise
        expect(source.close).toHaveBeenCalledTimes(1)
    })

    it('rejects unavailable bitmap and canvas capabilities explicitly', async () => {
        vi.stubGlobal('createImageBitmap', undefined)
        await expect(loadWorkerBoardTextures()).rejects.toMatchObject({ code: 'BITMAP_UNAVAILABLE' })
        vi.stubGlobal('createImageBitmap', vi.fn(async () => texture()))
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
        await expect(loadWorkerBoardTextures({ keys: ['up'] })).rejects.toMatchObject({ code: 'CANVAS_UNAVAILABLE' })
    })

    it.each([0, -1, 16.5, Infinity])('rejects invalid rasterization size %s', async (size) => {
        vi.stubGlobal('createImageBitmap', vi.fn())
        await expect(loadWorkerBoardTextures({ size })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    })
})
