import type { BoardRenderInput, RenderFrame, RenderOptions } from './coreTypes'
import type { BoardTextureKey, WorkerBoardTextures } from './tiles'

export type WorkerRenderSource = OffscreenCanvas | ImageBitmap
export type WorkerRenderFrame<T extends WorkerRenderSource = WorkerRenderSource> = RenderFrame<T>

export type WorkerTextureLoader = (key: BoardTextureKey, url: string, signal: AbortSignal) => Promise<ImageBitmap>

export interface WorkerRendererOptions {
    /** Owned by the renderer after successful construction, including unused entries. Never share these handles between instances. */
    textures?: WorkerBoardTextures
    /** Overrides bundled SVG URLs, e.g. with caller-deployed PNG assets. */
    textureUrls?: Partial<Record<BoardTextureKey, string>>
    /** Resolves relative texture URLs; defaults to the Worker entry module's import.meta.url. */
    assetBaseURL?: string | URL
    /** Successful results transfer ownership to this instance. Late results are closed on destruction. */
    loadTexture?: WorkerTextureLoader
}

export interface WorkerBoardRenderer {
    /** The Worker entry defaults to transferable ImageBitmap layers. */
    render(input: BoardRenderInput, options?: { output?: 'image-bitmap'; signal?: AbortSignal }): Promise<WorkerRenderFrame<ImageBitmap>>
    /** Canvas outputs are read-only leases within this realm; do not transfer their buffers. */
    render(input: BoardRenderInput, options: { output: 'canvas'; signal?: AbortSignal }): Promise<WorkerRenderFrame<OffscreenCanvas>>
    render(input: BoardRenderInput, options: RenderOptions): Promise<WorkerRenderFrame>
    destroy(): void
}
