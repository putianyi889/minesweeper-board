import type { MouseTraceMarker, MouseTraceResolvedMarker } from './mouseTrace'

export type TouchTraceAction = 'down' | 'move' | 'up' | 'cancel'

export interface TouchTraceEvent {
    /** Identifies one contact, from down to up/cancel; unique within the recording. */
    id: number
    row: number
    column: number
    action: TouchTraceAction
}

/** Uses the same shapes and cell-unit diameter/stroke widths as MouseTrace. */
export type TouchTraceMarker = MouseTraceMarker

export const defaultTouchTraceDownMarker: Readonly<MouseTraceResolvedMarker> = Object.freeze({
    shape: 'circle', size: 0.25, fill: 'currentColor', stroke: 'none', strokeWidth: 0, opacity: 0.6,
})

export const defaultTouchTraceActiveMarker: Readonly<MouseTraceResolvedMarker> = Object.freeze({
    shape: 'circle', size: 0.25, fill: 'currentColor', stroke: '#ffffff', strokeWidth: 0.035, opacity: 1,
})
