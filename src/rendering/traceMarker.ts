import type { MouseTraceMarker, MouseTraceResolvedMarker } from '../components/mouseTrace'

/** Common style resolution for the canvas mouse painter and SVG touch markers. */
export function resolveTraceMarker(marker: MouseTraceMarker | false | undefined, defaults: Readonly<MouseTraceResolvedMarker>) {
    return marker === false ? undefined : { ...defaults, ...marker }
}

export function clampTraceOpacity(value: number) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}
