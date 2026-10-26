# TouchTrace

`TouchTrace` is a Vue layer for multi-contact replay. One SVG displays all paths,
persistent down markers and the latest position of each active contact. Paths
use cell coordinates and are clipped to the board. SVG scales with the board
without a device pixel ratio dependent canvas allocation.

```vue
<script setup lang="ts">
import { MinesweeperBoard, TouchTrace } from '@putianyi888/vue3-minesweeper-board'
import type { TouchTraceEvent } from '@putianyi888/vue3-minesweeper-board'

const board = [[10, 10, 10], [10, 10, 10]]
const events: readonly TouchTraceEvent[] = [
  { id: 10, row: 0.5, column: 0.5, action: 'down' },
  { id: 20, row: 1.5, column: 1.5, action: 'down' },
  { id: 10, row: 0.5, column: 2.5, action: 'move' },
  { id: 20, row: 1.5, column: 1.5, action: 'up' },
]
</script>

<template>
  <MinesweeperBoard :board="board" :size="32">
    <TouchTrace
      :events="events" :end-index="3" :line-width="0.08" :opacity="0"
      color="var(--trace-color, #145dc4)"
      :down-marker="{ shape: 'circle', size: 0.25, opacity: 0.6 }"
      :active-marker="{ shape: 'circle', size: 0.25, stroke: 'var(--page-background, white)' }"
    />
  </MinesweeperBoard>
</template>
```

At index `3`, contacts `10` and `20` are both active. At index `4`, only `10`
remains active. Neither lifting nor cancellation removes history or adds a down
marker. Rewinding reconstructs the exact event prefix, including active contacts.
An active contact remains visible at the end of a recording with no matching
`up` or `cancel`.

## Events and index

```ts
type TouchTraceAction = 'down' | 'move' | 'up' | 'cancel'
interface TouchTraceEvent {
  id: number
  row: number
  column: number
  action: TouchTraceAction
}
```

`id` identifies one contact and must be unique throughout the recording. Map a
reused browser `pointerId` to a new contact ID for each subsequent down. IDs can
be nonconsecutive. The caller validates recordings; events for different contacts
may interleave, but each contact starts with `down` and ends at most once.
Terminal event coordinates are included in the path. Orphan moves/terminal events
are ignored; nonfinite coordinates do not add geometry.

`endIndex` is the number of processed events, the exclusive bound of
`[0, endIndex)`. It defaults to `events.length`, truncates fractions and clamps
to `0..events.length`; `NaN` means `0`. Use `endIndex = eventIndex + 1` when your
player stores the current event's zero-based index, or `0` before the first event.
Only this prefix is visible; there is no time-window truncation of its history.

`row: 0.5, column: 0.5` is the top-left cell center. Integer coordinates lie on
grid lines. Coordinates outside the board are retained and clipped by the SVG
viewport. The layer reads the board dimensions and actual size (including
`size="auto"`) from `MinesweeperBoard`. Without a board matrix, it infers the
extent from the complete event sequence. A template ref exposes `cellSize`.

## Props and styles

| Name | Type | Default / meaning |
| --- | --- | --- |
| `events` | `readonly TouchTraceEvent[]` | Required, complete event sequence. |
| `endIndex` | `number` | `events.length`, exclusive bound. |
| `lineWidth` | `number` | `0.08` cells. Zero hides paths. |
| `color` | `string` | `currentColor`; CSS colors, variables and inherited colors work. |
| `opacity` | `number` | `0.2`, black background mask only. Set `0` for transparency; paths and markers remain visible. |
| `downMarker` | `TouchTraceMarker \| false` | Circle, diameter `0.25`, fill `currentColor`, no stroke, opacity `0.6`. |
| `activeMarker` | `TouchTraceMarker \| false` | Circle, diameter `0.25`, fill `currentColor`, white stroke `0.035` cells, opacity `1`. |

`TouchTraceMarker` aliases the existing `MouseTraceMarker` fields: `shape`,
`size`, `fill`, `stroke`, `strokeWidth`, `opacity`. Shapes are `circle`, `ring`,
`cross`, `square`, `diamond`. `size` is the diameter or outer size in cells,
**not the radius**. Marker opacity is independent of mask opacity. Styles merge
with their respective defaults; `false` hides either marker group independently.
Use `stroke: 'none'` for no outline, and `fill: 'none'` or `'transparent'` for no
fill. Ring and cross markers have no fill. Opacities clamp to `0..1`.

The root SVG has `pointer-events: none`, `overflow: hidden` and `aria-hidden`.
It does not intercept board input, scrolling or dragging. CSS color changes apply
through SVG inheritance without clearing or reconstructing the recording cache.
The defaults are exported as `defaultTouchTraceDownMarker` and
`defaultTouchTraceActiveMarker`, both immutable.

## Updating recordings and orientation

Changing only `endIndex` forward processes new events, updates the affected path
strings and moves active markers. It does not scan all historical events or
reconstruct their paths. Backward seeks and recording replacement rebuild the
requested prefix. Size/board/style changes update SVG geometry or styling without
pixel caches, so scaling never leaves stale raster buffers.

Vue-reactive in-place edits (event fields, `push`, `splice`) are deep-watched and
rebuild the current prefix. The deep event watcher is separate from the index
watcher, so index updates do not traverse the history. As with other Vue props,
mutating a plain or `markRaw` array does not notify Vue: replace the array
reference after editing it. For large immutable recordings, `shallowRef` with
reference replacement avoids unnecessary deep proxies.

Transpose before passing events, retaining IDs, action order and index:

```ts
const visibleEvents = computed(() => transposed.value
  ? originalEvents.value.map((event) => ({ ...event, row: event.column, column: event.row }))
  : originalEvents.value)
```

Pass the transposed board too; the source recording remains unchanged. This
component does not read timestamps, decode recordings, run a playback clock,
implement game rules or attach touch/pointer event listeners. This first version
provides the Vue SVG layer; standalone canvas/bitmap and Worker output remain
future extensions.

## Example and verification

<script setup>
import TouchTraceExample from '../components/TouchTraceExample.vue'
</script>

<ClientOnly><TouchTraceExample /></ClientOnly>

Regression tests cover lifecycle, terminal coordinates, seeks, empty/replaced and
reactively edited arrays, marker shapes, styles, scale and incremental event
reads. The native Chrome check uses 10,000 events / 500 contacts on a 16×30 board
at 32px, DPR 2, Vite development and production, plus 60 recording replacements
with rewind and unmount/remount. It measures DOM nodes and live JS heap after GC.

```sh
npm run lintfix
npm run test
npm run build
npm run test:touch:build
npm run test:touch:browser
```

Set `WORKER_TEST_BROWSER` to your Chrome/Edge executable if needed. No Cypress
is used. See the [implementation and performance report](https://github.com/putianyi889/minesweeper-board/blob/main/src/rendering/TOUCH_TRACE.md)
for methodology, measurements and limitations.
