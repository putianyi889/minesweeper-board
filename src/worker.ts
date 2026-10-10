import { BoardRenderingCore } from './rendering/core'
import { BoardRenderError } from './rendering/errors'
import type { RenderingBackend } from './rendering/backend'
import { boardTextureUrls } from './rendering/tiles'
import type { BoardTextureKey } from './rendering/tiles'
import type { WorkerBoardRenderer, WorkerRendererOptions } from './rendering/workerTypes'

export { BoardRenderError } from './rendering/errors'
export type { BoardRenderErrorCode } from './rendering/errors'
export { boardTextureUrls } from './rendering/tiles'
export type { BoardTextureKey, WorkerBoardTextures } from './rendering/tiles'
export type { BoardRenderInput, BoardLayerName, MouseTraceSettings, RenderDimensions, RenderOptions, RenderOutput } from './rendering/coreTypes'
export type { ProbabilityColor } from './rendering/probability'
export type { WorkerBoardRenderer, WorkerRendererOptions, WorkerRenderFrame, WorkerRenderSource, WorkerTextureLoader } from './rendering/workerTypes'
export { defaultMouseTraceColor, defaultMouseTraceMarkers } from './components/mouseTrace'
export type { MouseTraceAction, MouseTraceColor, MouseTraceEvent, MouseTraceMarker, MouseTraceMarkers, MouseTraceState } from './components/mouseTrace'

/** DOM-free entry for module Workers. Inject bitmaps for bundled SVGs when native SVG Blob decoding is unsupported. */
export function createBoardRenderer(options: WorkerRendererOptions = {}): WorkerBoardRenderer {
    if (typeof OffscreenCanvas !== 'function') {
        throw new BoardRenderError('CANVAS_UNAVAILABLE', 'Worker rendering requires OffscreenCanvas.')
    }
    // Copy option maps so later mutations cannot change this instance's resource ownership or URL configuration.
    const unused = new Map<BoardTextureKey, ImageBitmap>()
    const seen = new Set<ImageBitmap>()
    for (const [name, texture] of Object.entries(options.textures ?? {})) {
        if (!Object.hasOwn(boardTextureUrls, name)) {
            throw new BoardRenderError('INVALID_INPUT', `Unknown board texture key: ${name}`)
        }
        const key = name as BoardTextureKey
        if (texture !== undefined) {
            if (typeof texture.close !== 'function' || texture.width === 0 || texture.height === 0 || seen.has(texture)) {
                throw new BoardRenderError('INVALID_INPUT', 'Injected textures must be distinct, live ImageBitmap handles.')
            }
            seen.add(texture)
            unused.set(key, texture)
        }
    }
    const urls = { ...boardTextureUrls }
    for (const [name, url] of Object.entries(options.textureUrls ?? {})) {
        if (!Object.hasOwn(boardTextureUrls, name) || typeof url !== 'string' || url.length === 0) {
            throw new BoardRenderError('INVALID_INPUT', `Invalid texture URL override: ${name}`)
        }
        urls[name as BoardTextureKey] = url
    }
    let base: URL
    try { base = new URL(options.assetBaseURL ?? import.meta.url) } catch (cause) {
        throw new BoardRenderError('INVALID_INPUT', 'assetBaseURL must be an absolute URL.', cause)
    }
    const loader = options.loadTexture ?? fetchTexture
    const backend: RenderingBackend<OffscreenCanvas, ImageBitmap> = {
        defaultOutput: 'image-bitmap',
        createCanvas: (width, height) => new OffscreenCanvas(width, height),
        getContext: (canvas) => canvas.getContext('2d'),
        drawTexture: (context, texture, x, y, size) => (context as OffscreenCanvasRenderingContext2D).drawImage(texture, x, y, size, size),
        loadTexture: async (key, _url, signal) => {
            const injected = unused.get(key)
            unused.delete(key)
            let url = 'injected bitmap'
            try {
                if (!injected) url = new URL(urls[key], base).href
                const texture = injected ?? await loader(key, url, signal)
                if (texture.width === 0 || texture.height === 0) {
                    texture.close()
                    throw new Error(`Texture ${key} is empty, closed or transferred.`)
                }
                return texture
            } catch (cause) {
                throw new BoardRenderError('TEXTURE_LOAD_FAILED', `Failed to load/decode board texture ${key}: ${url}`, cause)
            }
        },
        disposeTexture: (texture) => texture.close(),
        createBitmap: (canvas) => {
            if (typeof canvas.transferToImageBitmap !== 'function') {
                throw new BoardRenderError('BITMAP_UNAVAILABLE', 'Worker rendering requires OffscreenCanvas.transferToImageBitmap().')
            }
            return Promise.resolve(canvas.transferToImageBitmap())
        },
        destroy: () => {
            for (const texture of unused.values()) texture.close()
            unused.clear()
        },
    }
    return new BoardRenderingCore(backend) as WorkerBoardRenderer
}

async function fetchTexture(_key: BoardTextureKey, url: string, signal: AbortSignal): Promise<ImageBitmap> {
    if (typeof fetch !== 'function' || typeof createImageBitmap !== 'function') {
        throw new BoardRenderError('BITMAP_UNAVAILABLE', 'Texture loading requires fetch and createImageBitmap, or injected decoded textures.')
    }
    const response = await fetch(url, { signal, mode: 'cors', credentials: 'same-origin' })
    if (!response.ok) throw new Error(`Texture request failed: HTTP ${response.status} (${url})`)
    return createImageBitmap(await response.blob())
}
