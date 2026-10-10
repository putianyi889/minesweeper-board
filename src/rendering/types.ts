import type { MouseTraceColor, MouseTraceEvent, MouseTraceMarkers } from '../components/mouseTrace'
import type { ProbabilityColor } from './probability'

export type BoardLayerName = 'background' | 'foreground' | 'probability' | 'mouseTrace'
export type RenderOutput = 'canvas' | 'image-bitmap'
export type RenderSource = HTMLCanvasElement | ImageBitmap

export interface MouseTraceSettings {
    events: readonly MouseTraceEvent[]
    startIndex?: number
    endIndex?: number
    color?: Partial<MouseTraceColor>
    markers?: MouseTraceMarkers
    /** Black trace background opacity. Set to 0 for a transparent trace layer. */
    opacity?: number
    lineWidth?: number
}

export interface BoardRenderInput {
    /** Defines the shared extent and ms_toollib cell states for all layers. */
    board: readonly (readonly number[])[]
    /** Positive finite cell side length in pixels; fractional sizes are preserved. */
    size: number
    /** Background and foreground default to true; other layers default to false. */
    layers?: {
        background?: boolean | { board?: readonly (readonly boolean[])[] }
        foreground?: boolean | { board?: readonly (readonly number[])[] }
        probability?: false | { board: readonly (readonly number[])[]; color?: ProbabilityColor }
        mouseTrace?: false | MouseTraceSettings
    }
}

export interface RenderOptions { output?: RenderOutput }

export interface RenderDimensions {
    /** Bitmap dimensions, rounded up so fractional cell extents are not truncated. */
    readonly width: number
    readonly height: number
    readonly cellSize: number
}

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
    render(input: BoardRenderInput, options?: { output?: 'canvas' }): Promise<BoardRenderFrame<HTMLCanvasElement>>
    render(input: BoardRenderInput, options: { output: 'image-bitmap' }): Promise<BoardRenderFrame<ImageBitmap>>
    render(input: BoardRenderInput, options: RenderOptions): Promise<BoardRenderFrame>
    /** Rejects pending/new renders and releases cached textures and idle buffers. Leased frames remain valid. */
    destroy(): void
}

export interface LayerRenderHandle {
    readonly cellSize: number
    render(options?: { output?: 'canvas' }): Promise<LayerRenderFrame<HTMLCanvasElement>>
    render(options: { output: 'image-bitmap' }): Promise<LayerRenderFrame<ImageBitmap>>
    render(options: RenderOptions): Promise<LayerRenderFrame>
}
