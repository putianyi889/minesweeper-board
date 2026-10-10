import type { MouseTraceColor, MouseTraceEvent, MouseTraceMarkers } from '../components/mouseTrace'
import type { ProbabilityColor } from './probability'

export type BoardLayerName = 'background' | 'foreground' | 'probability' | 'mouseTrace'
export type RenderOutput = 'canvas' | 'image-bitmap'
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

export interface RenderOptions {
    output?: RenderOutput
    /** Cancels this request; reusable texture loads may continue until renderer destruction. */
    signal?: AbortSignal
}

export interface RenderDimensions {
    /** Bitmap dimensions, rounded up so fractional cell extents are not truncated. */
    readonly width: number
    readonly height: number
    readonly cellSize: number
}

export interface RenderFrame<T> extends RenderDimensions {
    readonly layers: Readonly<Partial<Record<BoardLayerName, T>>>
    readonly released: boolean
    /** Idempotent; returns canvas leases or closes sender-owned bitmap handles. */
    release(): void
}
