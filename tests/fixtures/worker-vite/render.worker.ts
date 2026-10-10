import { BoardRenderError, createBoardRenderer } from '@putianyi888/vue3-minesweeper-board/worker'
import type { BoardRenderInput, WorkerBoardRenderer, WorkerBoardTextures, WorkerRendererOptions } from '@putianyi888/vue3-minesweeper-board/worker'

let renderer: WorkerBoardRenderer | undefined

onmessage = async ({ data }: MessageEvent<{ id: number; type: string; textures?: WorkerBoardTextures; textureUrls?: WorkerRendererOptions['textureUrls']; input?: BoardRenderInput }>) => {
    const { id } = data
    try {
        if (data.type === 'init') {
            // Native Workers have no DOM. This also checks that the imported module has no indirect DOM initialization.
            if ('document' in globalThis || 'window' in globalThis) throw new Error('Worker unexpectedly has DOM globals.')
            try { renderer = createBoardRenderer({ textures: data.textures, textureUrls: data.textureUrls }) } catch (cause) {
                Object.values(data.textures ?? {}).forEach((source) => source.close())
                throw cause
            }
            postMessage({ id, ready: true })
        } else if (data.type === 'destroy') {
            renderer?.destroy()
            postMessage({ id, destroyed: true })
        } else if (data.type === 'render') {
            if (!renderer || !data.input) throw new Error('Worker not initialized or input missing.')
            const frame = await renderer.render({ ...data.input, layers: {
                ...data.input.layers,
                probability: { board: [[0.25, 0, 0], [0.75, 0, 0]], color: () => '#123456' },
            } })
            try {
                postMessage({ id, layers: frame.layers, width: frame.width, height: frame.height, cellSize: frame.cellSize }, {
                    transfer: Object.values(frame.layers),
                })
            } finally {
                // Closes only sender-side handles, which are detached after successful transfer.
                frame.release()
            }
        } else throw new Error(`Unknown message: ${data.type}`)
    } catch (cause) {
        postMessage({ id, error: { code: cause instanceof BoardRenderError ? cause.code : 'TEST_FAILED', message: String(cause) } })
    }
}
