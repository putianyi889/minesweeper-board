import { nextTick, onBeforeUnmount } from 'vue'
import { BoardRenderError, createBoardRenderer } from './renderer'
import type { BoardLayerName, BoardRenderInput, BoardRenderer, LayerRenderFrame, RenderOptions } from './types'

/** Exports a detached snapshot, never the component's mutable display canvas. */
export function useLayerRenderer(name: BoardLayerName, getInput: () => BoardRenderInput) {
    let renderer: BoardRenderer | undefined
    let unmounted = false
    onBeforeUnmount(() => {
        unmounted = true
        renderer?.destroy()
    })

    function render(options?: { output?: 'canvas'; signal?: AbortSignal }): Promise<LayerRenderFrame<HTMLCanvasElement>>
    function render(options: { output: 'image-bitmap'; signal?: AbortSignal }): Promise<LayerRenderFrame<ImageBitmap>>
    function render(options: RenderOptions): Promise<LayerRenderFrame>
    async function render(options: RenderOptions = {}): Promise<LayerRenderFrame> {
        // Includes prop/context updates already scheduled by Vue. Decode never relies on a screen refresh.
        await nextTick()
        if (unmounted) throw new BoardRenderError('DESTROYED', 'The layer component has been unmounted.')
        renderer ??= createBoardRenderer()
        const frame = await renderer.render(getInput(), options)
        if (unmounted) {
            frame.release()
            throw new BoardRenderError('DESTROYED', 'The layer component has been unmounted.')
        }
        const source = frame.layers[name]
        if (source === undefined) {
            frame.release()
            throw new BoardRenderError('DRAW_FAILED', `The ${name} output is missing.`)
        }
        return Object.freeze({
            source, width: frame.width, height: frame.height, cellSize: frame.cellSize,
            get released() { return frame.released },
            release: () => frame.release(),
        })
    }

    return render
}

/** Uses hidden-cell states when a standalone layer has no source board context. */
export function getLayerSourceBoard(source: number[][] | undefined, matrix: readonly (readonly unknown[])[]) {
    return source ?? matrix.map((row) => row.map(() => 10))
}
