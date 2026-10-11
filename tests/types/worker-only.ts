// This intentionally checks the published subpath with no DOM or Vue type libraries.
import { createBoardRenderer } from '@putianyi888/vue3-minesweeper-board/worker'
import type { WorkerBoardTextures, WorkerRenderFrame, BoardRenderInput, ProbabilityColor } from '@putianyi888/vue3-minesweeper-board/worker'

export async function useWorkerRenderer(textures: WorkerBoardTextures, signal: AbortSignal) {
    const renderer = createBoardRenderer({ textures })
    const color: ProbabilityColor = (value) => value < 0.5 ? '#000000' : '#ff0000'
    const input: BoardRenderInput = { board: [[10]], size: 23.5, layers: { probability: { board: [[0.25]], color } } }
    try {
        const frame: WorkerRenderFrame<ImageBitmap> = await renderer.render(input, { signal })
        try {
            const payload = { layers: frame.layers, width: frame.width, height: frame.height, cellSize: frame.cellSize }
            postMessage(payload, Object.values(frame.layers))
        } finally { frame.release() }
        const canvasFrame: WorkerRenderFrame<OffscreenCanvas> = await renderer.render(input, { output: 'canvas', signal })
        canvasFrame.release()
    } finally { renderer.destroy() }
}
