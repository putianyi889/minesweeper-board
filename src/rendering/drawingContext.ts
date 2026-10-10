/** The common 2D operations used by the board painters, available in DOM and WebWorker TS libraries. */
export type DrawingContext = Pick<OffscreenCanvasRenderingContext2D,
    'clearRect' | 'fillRect' | 'fillText' | 'save' | 'restore' | 'beginPath' | 'closePath' |
    'moveTo' | 'lineTo' | 'stroke' | 'fill' | 'rect' | 'arc' | 'fillStyle' | 'strokeStyle' |
    'font' | 'textAlign' | 'textBaseline' | 'lineWidth' | 'globalAlpha' | 'lineCap' | 'lineJoin'>
