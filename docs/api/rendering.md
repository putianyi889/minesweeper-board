# Canvas and bitmap rendering

`createBoardRenderer()` renders board layers without mounting Vue, changing the
visible board, or capturing DOM. It runs in a browser on the main thread.

```ts
import { createBoardRenderer } from '@putianyi888/vue3-minesweeper-board'

const renderer = createBoardRenderer()
try {
  const frame = await renderer.render({
    board: [[10, 1], [12, 11]],
    size: 24,
    layers: {
      probability: { board: [[0.25, 0], [0.75, 0]] },
      mouseTrace: {
        events: [
          { row: 0.5, column: 0.5, state: 'uu', action: 'mv' },
          { row: 1.5, column: 0.5, state: 'du', action: 'lc' },
        ],
        opacity: 0,
      },
    },
  })
  try {
    const composite = document.createElement('canvas')
    composite.width = frame.width
    composite.height = frame.height
    const context = composite.getContext('2d')!
    // The caller chooses order, layer opacity, cursor and crop.
    for (const name of ['background', 'mouseTrace', 'probability', 'foreground'] as const) {
      const source = frame.layers[name]
      if (source) context.drawImage(source, 0, 0)
    }
    // Copy or finish consuming frame.layers before releasing the frame.
    // composite is a separate canvas owned by this caller.
  } finally {
    frame.release()
  }
} finally {
  renderer.destroy()
}
```

For independent `ImageBitmap` sources, pass `{ output: 'image-bitmap' }` as the
second argument to `render`. Canvas output is the default. There is no silent
fallback if bitmap creation is unavailable or fails.

## Input and coordinates

| Field | Meaning |
| --- | --- |
| `board` | The ms_toollib board matrix. Defines the shared layer extent and probability visibility. Ragged rows are allowed. |
| `size` | Positive finite cell side length in pixels. Fractional values are retained as `frame.cellSize`. An independent renderer has no layout to resolve `'auto'`; pass a numeric size. |
| `layers.background` | `true` by default. `false` disables it; `{ board: boolean[][] }` overrides its cells. |
| `layers.foreground` | `true` by default. `false` disables it; `{ board: number[][] }` overrides its cells using the foreground values (`0`, `1`–`8`, `-1`–`-4`). |
| `layers.probability` | Disabled by default. `{ board: number[][], color?: ProbabilityColor }` enables it. Uses the same visibility, rounding, normalization and text style as `BoardProbability`. |
| `layers.mouseTrace` | Disabled by default. Accepts the same events, index window, colors, markers, opacity and line width as `MouseTrace`. |

Every enabled layer has origin `(0, 0)`, width
`Math.ceil(maxColumnCount * size)` and height `Math.ceil(rowCount * size)`.
The center of cell `(row, column)` is
`((column + 0.5) * frame.cellSize, (row + 0.5) * frame.cellSize)`.
Layer override matrices do not change the extent; missing cells remain transparent
and extra cells are clipped to the board extent. Bitmap dimensions are rounded up
without rounding the cell coordinates or introducing device pixel ratio scaling.

Foreground blanks and areas without probability or trace marks remain transparent.
Background assets retain their own alpha. The trace layer's `opacity` controls
its **black background**, with the component default of `0.2`; set it to `0` for
a transparent background. Overall layer opacity is left to the caller.

The renderer does not flatten the layers, add borders or custom cursors, crop,
parse replays, encode video, or retain a list of rendered frames.

## Completion and errors

`render()` snapshots matrices, events, marker styles, colors, size and index
window **when called**, before waiting for earlier requests or texture decoding.
Changing those input objects afterwards affects subsequent calls. Color callbacks
are retained by reference: keep any state they capture stable until rendering ends.
Requests on one renderer execute in invocation order.

The Promise resolves only after all selected layers are drawn and all textures
used by the snapshot are loaded and decoded. Bitmap output also waits for every
bitmap conversion. This uses [image decoding](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode),
not `requestAnimationFrame`, refresh rate estimates, fixed delays, or arbitrary
DOM inspection. Browsers without `decode()` use the image load/error events.

Failure rejects the whole request. Partial bitmap results are closed and canvas
buffers reclaimed. Failed texture entries are evicted so a later call may retry.
`BoardRenderError` provides a `code`, message, and original `cause` where available:

| Code | Meaning |
| --- | --- |
| `INVALID_INPUT` | Invalid cell size, dimensions or output mode. |
| `TEXTURE_LOAD_FAILED` | Texture download, decode or empty-image failure; message identifies the URL. |
| `CANVAS_UNAVAILABLE` | A required 2D canvas context cannot be created. |
| `BITMAP_UNAVAILABLE` | `createImageBitmap` is unavailable, or the requested bitmap extent is empty. Empty boards are supported for canvas output. |
| `DRAW_FAILED` | Drawing, a color callback, or bitmap conversion failed. |
| `DESTROYED` | The renderer was destroyed, or the exporting component unmounted. |

Bundled textures use anonymous CORS loading, including when a build serves assets
from a separate origin. That asset server must allow the origin; a failed load
rejects the Promise rather than returning a missing layer.

## Ownership and release

- The returned frame owns its output sources until `frame.release()`. Treat them
  as read-only while consuming them. Complete any asynchronous consumer before
  releasing the frame; creating the next frame does not overwrite this one.
- `release()` is idempotent and sets `frame.released` to `true`. All source
  references become invalid after release, even if their width is still nonzero.
  Do not retain, modify, transfer or draw from a released source.
- Canvas sources are leased buffers. Release returns them to an instance-local
  pool; they may be overwritten by a later render. The pool retains at most one
  idle canvas per layer, so retaining many frames is a caller-owned memory cost.
- Bitmap sources are independent from the buffers and are closed by `release()`.
  Do not close them separately. To transfer ownership to another consumer or keep
  a source beyond release, first make your own copy and manage that copy's lifetime.
- Decoded textures are reused across frames and sizes until `destroy()`.
  `destroy()` is idempotent, rejects active and queued requests immediately,
  prevents new renders, and clears textures and idle canvases. Already returned
  frames remain valid until their caller releases them. A bitmap conversion that
  finishes after destruction is closed rather than leaked.

## Component outputs

`BoardBackground`, `BoardForeground`, `BoardProbability`, and `MouseTrace` expose
the same handle through template refs:

```ts
import { ref } from 'vue'
import type { LayerRenderHandle } from '@putianyi888/vue3-minesweeper-board'

const probabilityLayer = ref<LayerRenderHandle>()

async function copyProbability() {
  const frame = await probabilityLayer.value!.render()
  try {
    // frame.source is a detached HTMLCanvasElement, ready for drawImage.
    // frame.cellSize is the actual size for this snapshot, including 'auto'.
  } finally {
    frame.release()
  }
}
```

The handle exposes `cellSize` and `render(options?)`. `render()` first waits for
already scheduled Vue updates, snapshots the component's inputs and resolved
board context, then performs the same independent rendering and decoding.
It returns `{ source, width, height, cellSize, released, release() }`; bitmap
output uses `render({ output: 'image-bitmap' })`.

The snapshot is separate from the mutable display canvas. This avoids depending
on the private canvas and fire-and-forget loading of `vue3-plots` `ImageGrid`
(the installed `0.6.0` API exposes only `cellIndex`). Public output completion
does not promise that the screen has repainted. Exporting does not alter the
displayed layer. Components reuse their export renderer until unmount, which
rejects pending calls and destroys that renderer. Exported frames still need
explicit release after unmount.

## Browser verification

Run `npm run docs:dev`, open `/rendering`, and use **Check canvas and bitmap**.
The example checks real SVG decoding, layer alpha, common dimensions, retained
canvas stability and bitmap conversion using native browser APIs. Vitest tests
cover state, failure and ownership contracts with simulated canvases and images;
they do not establish native rasterization behavior. Cypress is not configured
in this repository.
