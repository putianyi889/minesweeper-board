import './styles/border.css'

export { default as BoardBackground } from './components/BoardBackground.vue'
export { default as BoardForeground } from './components/BoardForeground.vue'
export { default as BoardProbability } from './components/BoardProbability.vue'
export { default as Counter } from './components/Counter.vue'
export { default as MinesweeperBoard } from './components/MinesweeperBoard.vue'
export { default as MouseTrace } from './components/MouseTrace.vue'
export { default } from './components/MinesweeperBoard.vue'
export {
    defaultMouseTraceColor,
    defaultMouseTraceMarkers,
    mouseTraceActions,
    mouseTraceMarkerActions,
    mouseTraceMarkerShapes,
    mouseTraceStates,
} from './components/mouseTrace'
export type {
    MouseTraceAction,
    MouseTraceColor,
    MouseTraceEvent,
    MouseTraceMarker,
    MouseTraceMarkerAction,
    MouseTraceMarkers,
    MouseTraceMarkerShape,
    MouseTraceResolvedMarker,
    MouseTraceState,
} from './components/mouseTrace'

export const outerBorderClass = 'outer-border'
export const innerBorderClass = 'inner-border'
export const minesweeperBoardClasses = {
    innerBorder: innerBorderClass,
    outerBorder: outerBorderClass,
} as const
