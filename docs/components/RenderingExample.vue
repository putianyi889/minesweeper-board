<template>
  <div>
    <button :disabled="busy" @click="checkOutputs">Check canvas and bitmap</button>
    <p role="status">{{ status }}</p>
    <canvas ref="preview" class="rendering-preview" aria-label="Composite of exported board layers" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { createBoardRenderer } from '@putianyi888/vue3-minesweeper-board'
import type { BoardRenderFrame, BoardRenderInput, BoardRenderer } from '@putianyi888/vue3-minesweeper-board'

const preview = ref<HTMLCanvasElement>()
const busy = ref(false)
const status = ref('Ready to check native browser rendering.')
let renderer: BoardRenderer | undefined
let unmounted = false

const input: BoardRenderInput = {
  board: [[10, 1, 11], [12, 2, 16]], size: 23.5,
  layers: {
    probability: { board: [[0.25, 0, 0], [0.75, 0, 0]] },
    mouseTrace: { opacity: 0, events: [
      { row: 0.5, column: 0.5, state: 'uu', action: 'mv' },
      { row: 1.5, column: 0.5, state: 'du', action: 'lc' },
    ] },
  },
}

function requireCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function pixels(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Native 2D context unavailable.')
  return context.getImageData(0, 0, canvas.width, canvas.height).data
}

async function checkOutputs() {
  busy.value = true
  status.value = 'Rendering…'
  renderer ??= createBoardRenderer()
  let first: BoardRenderFrame<HTMLCanvasElement> | undefined
  let second: BoardRenderFrame<HTMLCanvasElement> | undefined
  let bitmap: BoardRenderFrame<ImageBitmap> | undefined
  try {
    first = await renderer.render(input)
    requireCheck(first.width === 71 && first.height === 47 && first.cellSize === 23.5, 'Incorrect common dimensions.')
    for (const source of Object.values(first.layers)) {
      requireCheck(source.width === first.width && source.height === first.height, 'Layer extents differ.')
    }
    const foreground = pixels(first.layers.foreground!)
    const probability = pixels(first.layers.probability!)
    const trace = pixels(first.layers.mouseTrace!)
    requireCheck(foreground[3] === 0 && probability[3] === 0 && trace[3] === 0, 'Transparent pixels were filled.')
    requireCheck(foreground.some((value, index) => index % 4 === 3 && value > 0), 'Foreground textures are missing.')
    requireCheck(probability.some((value, index) => index % 4 === 3 && value > 0), 'Probability text is missing.')
    requireCheck(trace.some((value, index) => index % 4 === 3 && value > 0), 'Mouse trace is missing.')
    const previous = pixels(first.layers.background!).slice()
    second = await renderer.render({ ...input, board: [[0]], size: 32 })
    requireCheck(second.layers.background !== first.layers.background, 'A retained canvas was reused.')
    const retained = pixels(first.layers.background!)
    requireCheck(retained.length === previous.length && retained.every((value, index) => value === previous[index]), 'Previous frame was overwritten.')

    const target = preview.value
    if (!target || unmounted) throw new Error('Preview unmounted.')
    target.width = first.width
    target.height = first.height
    const context = target.getContext('2d')
    if (!context) throw new Error('Preview 2D context unavailable.')
    for (const name of ['background', 'mouseTrace', 'probability', 'foreground'] as const) {
      context.drawImage(first.layers[name]!, 0, 0)
    }
    bitmap = await renderer.render(input, { output: 'image-bitmap' })
    requireCheck(Object.values(bitmap.layers).every((source) => source.width === 71 && source.height === 47), 'Bitmap dimensions differ.')
    const foregroundCopy = document.createElement('canvas')
    foregroundCopy.width = 71
    foregroundCopy.height = 47
    const copyContext = foregroundCopy.getContext('2d')!
    copyContext.drawImage(bitmap.layers.foreground!, 0, 0)
    const copied = pixels(foregroundCopy)
    requireCheck(copied.every((value, index) => value === foreground[index]), 'Bitmap conversion changed foreground pixels.')
    foregroundCopy.width = 0
    foregroundCopy.height = 0
    status.value = 'Passed: SVG pixels, transparency, aligned extents, retained canvas, and bitmap conversion.'
  } catch (cause) {
    if (!unmounted) status.value = `Failed: ${cause instanceof Error ? cause.message : String(cause)}`
  } finally {
    bitmap?.release()
    second?.release()
    first?.release()
    if (!unmounted) busy.value = false
  }
}

onBeforeUnmount(() => {
  unmounted = true
  renderer?.destroy()
})
</script>

<style scoped>
.rendering-preview {
  display: block;
  image-rendering: pixelated;
  width: 284px;
}
</style>
