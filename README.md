# @putianyi888/vue3-minesweeper-board

Vue 3 component for rendering a Minesweeper board matrix.

## Install

```sh
npm install @putianyi888/vue3-minesweeper-board vue
```

## Usage

```vue
<script setup lang="ts">
import MinesweeperBoard from '@putianyi888/vue3-minesweeper-board'

const board = [
  [10, 10, 10],
  [1, 2, 1],
  [0, 0, 0],
]
</script>

<template>
  <MinesweeperBoard :board="board" :size="24" />
</template>
```

`board` follows `ms_toollib` game board values. Unsupported values render as
an unopened background cell with a blank foreground.

You can also import the lower-level layers:

```ts
import { BoardBackground, BoardForeground, Counter, MinesweeperBoard } from '@putianyi888/vue3-minesweeper-board'
```

Use `TouchTrace` in a board slot to replay independent multi-touch paths, persistent
down markers and simultaneous active contacts. It accepts plain `TouchTraceEvent`
arrays and an exclusive `endIndex`; the caller controls playback. One SVG caches
paths during forward playback, supports rewind, transparent masks and CSS theme
colors. See [TouchTrace](docs/api/touch-trace.md) for props, examples and mutation rules.

```vue
<Counter :value="12.34" :fixed="2" :digits="3" :size="24" />
```

## Canvas / Bitmap Output

Render independent layers without mounting a component:

```ts
import { createBoardRenderer } from '@putianyi888/vue3-minesweeper-board'

const renderer = createBoardRenderer()
try {
  const frame = await renderer.render({ board: [[10, 1]], size: 24 })
  try {
    // Ready-to-use frame.layers.background and frame.layers.foreground canvases.
    // All layers use frame.width, frame.height and frame.cellSize.
    // Consume/copy the sources here; later renders do not overwrite this frame.
  } finally {
    frame.release()
  }
} finally {
  renderer.destroy()
}
```

Pass `{ output: 'image-bitmap' }` for bitmap output. Probability and mouse trace
are optional layers. Each board layer component also exposes `render()` and its
actual `cellSize` through a template ref. Rendering waits for texture decode and
rejects on failure. Released canvas buffers and decoded textures are reused.
See the [rendering API](docs/api/rendering.md) for completion and ownership rules,
and the [browser verification example](docs/rendering.md).

Module Workers can import `createBoardRenderer` from
`@putianyi888/vue3-minesweeper-board/worker`. This DOM-free entry uses
OffscreenCanvas and defaults to transferable ImageBitmap layers. Prepare the
built-in SVG textures once with the main-thread `loadWorkerBoardTextures()`
helper, then transfer an independently owned set to each Worker. Worker-local
PNG loading and custom bitmap loaders are also supported. The caller manages
Worker scheduling, compositing and encoding. See [Worker rendering](docs/api/worker-rendering.md)
for Vite setup, cancellation, deployment and resource ownership.
