export type MouseTraceState = 'uu' | 'du' | 'ud' | 'dd'
export type MouseTraceAction = 'mv' | 'lc' | 'lr' | 'rc' | 'rr'
export type MouseTraceMarkerAction = Exclude<MouseTraceAction, 'mv'>
export type MouseTraceMarkerShape = 'circle' | 'ring' | 'cross' | 'square' | 'diamond'

export type MouseTraceEvent = {
    row: number
    column: number
    state: MouseTraceState
    action: MouseTraceAction
}

export type MouseTraceColor = Record<MouseTraceState, string>
export type MouseTraceMarker = {
    shape?: MouseTraceMarkerShape
    size?: number
    fill?: string
    stroke?: string
    strokeWidth?: number
    opacity?: number
}
export type MouseTraceResolvedMarker = Required<MouseTraceMarker>
export type MouseTraceMarkers = Partial<Record<MouseTraceMarkerAction, MouseTraceMarker | false>>

export const mouseTraceStates = ['uu', 'du', 'ud', 'dd'] as const
export const mouseTraceActions = ['mv', 'lc', 'lr', 'rc', 'rr'] as const
export const mouseTraceMarkerActions = ['lc', 'lr', 'rc', 'rr'] as const
export const mouseTraceMarkerShapes = ['circle', 'ring', 'cross', 'square', 'diamond'] as const

export const defaultMouseTraceColor: MouseTraceColor = {
    dd: '#ff4fd8',
    du: '#ffdf00',
    ud: '#38d9ff',
    uu: '#ffffff',
}

export const defaultMouseTraceMarkers: Record<MouseTraceMarkerAction, MouseTraceResolvedMarker> = {
    lc: {
        fill: '#ffdf00',
        opacity: 1,
        shape: 'circle',
        size: 0.5,
        stroke: '#ffffff',
        strokeWidth: 0.075,
    },
    lr: {
        fill: 'transparent',
        opacity: 1,
        shape: 'ring',
        size: 0.58,
        stroke: '#ffdf00',
        strokeWidth: 0.075,
    },
    rc: {
        fill: '#38d9ff',
        opacity: 1,
        shape: 'diamond',
        size: 0.5,
        stroke: '#ffffff',
        strokeWidth: 0.075,
    },
    rr: {
        fill: 'transparent',
        opacity: 1,
        shape: 'cross',
        size: 0.5,
        stroke: '#38d9ff',
        strokeWidth: 0.1,
    },
}
