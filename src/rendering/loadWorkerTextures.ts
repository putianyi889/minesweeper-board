import { BoardRenderError } from './errors'
import { loadDomTexture } from './domBackend'
import { boardTextureUrls } from './tiles'
import type { BoardTextureKey, WorkerBoardTextures } from './tiles'

export interface LoadWorkerTexturesOptions {
    signal?: AbortSignal
    /** Defaults to all built-in nonblank textures. */
    keys?: readonly BoardTextureKey[]
    /** Rasterization resolution per texture; larger values suit exports with larger cells. Default 160. */
    size?: number
}

/** Main-thread preparation only. Rasterizes bundled SVG textures once, ready to transfer to one Worker instance. */
export async function loadWorkerBoardTextures(options: LoadWorkerTexturesOptions = {}): Promise<WorkerBoardTextures> {
    if (typeof createImageBitmap !== 'function') throw new BoardRenderError('BITMAP_UNAVAILABLE', 'Texture preparation requires createImageBitmap.')
    const size = options.size ?? 160
    if (!Number.isInteger(size) || size <= 0 || size > 0xffffffff) {
        throw new BoardRenderError('INVALID_INPUT', 'Texture rasterization size must be a positive canvas-sized integer.')
    }
    const controller = new AbortController()
    const { signal } = controller
    const abort = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()
    const textures: WorkerBoardTextures = {}
    const keys = [...new Set(options.keys ?? Object.keys(boardTextureUrls) as BoardTextureKey[])]
    let failed = false
    try {
        await new Promise<void>((resolve, reject) => {
            const onAbort = () => reject(new BoardRenderError('CANCELLED', 'Worker texture preparation was cancelled.', signal.reason))
            signal.addEventListener('abort', onAbort, { once: true })
            if (signal.aborted) onAbort()
            void Promise.all(keys.map(async (key) => {
                let image: HTMLImageElement | undefined
                let canvas: HTMLCanvasElement | undefined
                try {
                    if (!Object.hasOwn(boardTextureUrls, key)) throw new Error(`Unknown board texture key: ${key}`)
                    image = await loadDomTexture(boardTextureUrls[key], signal)
                    canvas = document.createElement('canvas')
                    canvas.width = size
                    canvas.height = size
                    const context = canvas.getContext('2d')
                    if (!context) throw new BoardRenderError('CANVAS_UNAVAILABLE', 'Cannot rasterize a Worker texture.')
                    context.drawImage(image, 0, 0, size, size)
                    const bitmap = await createImageBitmap(canvas)
                    if (failed || signal.aborted) bitmap.close()
                    else textures[key] = bitmap
                } catch (cause) {
                    if (cause instanceof BoardRenderError) throw cause
                    throw new BoardRenderError('TEXTURE_LOAD_FAILED', `Failed to prepare Worker texture ${key}.`, cause)
                } finally {
                    if (image) image.src = ''
                    if (canvas) { canvas.width = 0; canvas.height = 0 }
                }
            })).then(() => {
                signal.removeEventListener('abort', onAbort)
                resolve()
            }, (cause) => {
                signal.removeEventListener('abort', onAbort)
                reject(cause)
            })
        })
        return textures
    } catch (cause) {
        failed = true
        controller.abort()
        for (const texture of Object.values(textures)) texture.close()
        throw cause
    } finally {
        options.signal?.removeEventListener('abort', abort)
    }
}
