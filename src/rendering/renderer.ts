import { BoardRenderingCore } from './core'
import { createDomBackend } from './domBackend'
import type { BoardRenderer } from './types'
export { BoardRenderError } from './errors'
export type { BoardRenderErrorCode } from './errors'

/** Creates the existing main-thread renderer, with HTML canvas output by default. */
export function createBoardRenderer(): BoardRenderer {
    return new BoardRenderingCore(createDomBackend()) as BoardRenderer
}
