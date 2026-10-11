import type { BoardLayerName, BoardRenderInput, RenderDimensions, RenderOptions } from './coreTypes'
export type { BoardLayerName, BoardRenderInput, MouseTraceSettings, RenderDimensions, RenderOptions, RenderOutput } from './coreTypes'

export type RenderSource = HTMLCanvasElement | ImageBitmap

export interface BoardRenderFrame<T extends RenderSource = RenderSource> extends RenderDimensions {
    /** All enabled layers share (0, 0), width, height and cellSize. */
    readonly layers: Readonly<Partial<Record<BoardLayerName, T>>>
    readonly released: boolean
    /** Idempotent. Invalidates the sources; do not read/write/transfer them afterwards. */
    release(): void
}

export interface LayerRenderFrame<T extends RenderSource = RenderSource> extends RenderDimensions {
    readonly source: T
    readonly released: boolean
    release(): void
}

export interface BoardRenderer {
    render(input: BoardRenderInput, options?: { output?: 'canvas'; signal?: AbortSignal }): Promise<BoardRenderFrame<HTMLCanvasElement>>
    render(input: BoardRenderInput, options: { output: 'image-bitmap'; signal?: AbortSignal }): Promise<BoardRenderFrame<ImageBitmap>>
    render(input: BoardRenderInput, options: RenderOptions): Promise<BoardRenderFrame>
    /** Rejects pending/new renders and releases cached textures and idle buffers. Leased frames remain valid. */
    destroy(): void
}

export interface LayerRenderHandle {
    readonly cellSize: number
    render(options?: { output?: 'canvas'; signal?: AbortSignal }): Promise<LayerRenderFrame<HTMLCanvasElement>>
    render(options: { output: 'image-bitmap'; signal?: AbortSignal }): Promise<LayerRenderFrame<ImageBitmap>>
    render(options: RenderOptions): Promise<LayerRenderFrame>
}
