export type BoardRenderErrorCode = 'DESTROYED' | 'CANCELLED' | 'INVALID_INPUT' | 'TEXTURE_LOAD_FAILED' |
    'CANVAS_UNAVAILABLE' | 'BITMAP_UNAVAILABLE' | 'DRAW_FAILED'

export class BoardRenderError extends Error {
    constructor(public readonly code: BoardRenderErrorCode, message: string, cause?: unknown) {
        super(message, { cause })
        this.name = 'BoardRenderError'
    }
}
