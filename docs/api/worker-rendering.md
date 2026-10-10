# Worker rendering

Import the public ESM subpath inside a browser **module Worker**:

```ts
import { createBoardRenderer } from '@putianyi888/vue3-minesweeper-board/worker'
```

This entry has no Vue, CSS, DOM canvas/image constructors, `window` or `document`
dependencies, including at import and instance creation. It shares the drawing
core with the existing main-thread entry. The main-thread API still returns
HTML canvases by default; the Worker API defaults to **ImageBitmap** layers.
It requires OffscreenCanvas 2D and, for bitmap output,
`OffscreenCanvas.transferToImageBitmap`. Unsupported capabilities fail explicitly.

## Prepare the built-in textures

The built-in textures are SVGs. Native SVG Blob decoding varies between browsers;
use the main-thread preparation helper for a portable initialization path:

```ts
// Main thread, e.g. export.ts in a Vite application
import { loadWorkerBoardTextures } from '@putianyi888/vue3-minesweeper-board'

const worker = new Worker(new URL('./board.worker.ts', import.meta.url), { type: 'module' })
const textures = await loadWorkerBoardTextures({ size: 256 })
try {
  worker.postMessage({ type: 'init', textures }, Object.values(textures))
} catch (cause) {
  Object.values(textures).forEach((bitmap) => bitmap.close())
  throw cause
}
// Wait for the caller-defined "ready" message before submitting frames.
```

`loadWorkerBoardTextures({ keys?, size?, signal? })` decodes the bundled SVGs and
rasterizes them without mounting or updating a visible board. It defaults to all
14 nonblank textures at 160 × 160 pixels; `size` selects a positive integer
rasterization resolution, independently of the render input's `cellSize`.
Choose enough resolution for your largest export cells; fixed raster textures
can have different antialiasing from directly scaled SVGs. Transparent texels
are preserved. Preparation rejects as a whole on failure/cancellation and closes
partial or late bitmap results. Successful results belong to the caller until
transferred or accepted by a renderer.

Prepare a separate set for each Worker, or make independent bitmap copies of a
prepared set with `createImageBitmap`. A transferred handle cannot initialize
another Worker. Preparation is once per instance initialization, not once per
frame. Callers may limit `keys` to the textures their frames will actually use.
Missing injected keys are loaded by the configured Worker loader; they are not
silently treated as blanks.

```ts
// board.worker.ts
import { BoardRenderError, createBoardRenderer } from '@putianyi888/vue3-minesweeper-board/worker'
import type { WorkerBoardRenderer } from '@putianyi888/vue3-minesweeper-board/worker'

let renderer: WorkerBoardRenderer | undefined

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      try {
        renderer = createBoardRenderer({ textures: data.textures })
      } catch (cause) {
        // Construction failed: these recipient handles still belong to this caller.
        Object.values(data.textures as Record<string, ImageBitmap>).forEach((bitmap) => bitmap.close())
        throw cause
      }
      self.postMessage({ type: 'ready' })
    } else if (data.type === 'render') {
      if (!renderer) throw new Error('Renderer not initialized.')
      // Build probability color functions here, never send functions/source through postMessage.
      const frame = await renderer.render(data.input)
      try {
        self.postMessage({
          type: 'frame', index: data.index,
          width: frame.width, height: frame.height, cellSize: frame.cellSize,
          layers: frame.layers,
        }, Object.values(frame.layers))
      } finally {
        frame.release()
      }
    } else if (data.type === 'destroy') {
      renderer?.destroy()
    }
  } catch (cause) {
    self.postMessage({ type: 'error', index: data.index,
      code: cause instanceof BoardRenderError ? cause.code : 'APPLICATION_ERROR',
      message: String(cause),
    })
  }
}
```

The receiver handles frame ordering, compositing, cropping and encoding. After
finishing an asynchronous consumer, close **all recipient bitmap handles** in a
`finally` block. Posting the whole frame object is invalid because it includes
methods; send only metadata and `frame.layers`, with the bitmap transfer list.

## Worker-local loading and URL deployment

`createBoardRenderer(options?)` accepts:

| Option | Meaning |
| --- | --- |
| `textures` | `Partial<Record<BoardTextureKey, ImageBitmap>>`. Distinct live bitmap handles owned by this instance after successful construction, including unused entries. |
| `textureUrls` | Override selected bundled URLs, e.g. with pre-rasterized PNG files. |
| `assetBaseURL` | Absolute base for relative texture URLs. Defaults to the Worker entry module's `import.meta.url`, not the page's document base. |
| `loadTexture` | `(key, resolvedURL, lifetimeSignal) => Promise<ImageBitmap>`, constructed inside the Worker. Successful results must be new, independently owned handles; they belong to the renderer. |

The immutable `boardTextureUrls` catalog and `BoardTextureKey` type are exported
from `/worker`: `up`, `down`, `num1`–`num8`, `mine`, `flag`, `falsemine`, `blast`.
Blanks do not require an image. The URL and injected-texture maps are snapshotted
at construction. The loader is called only once per successfully cached key,
independently of frame number or cell size. Each renderer owns separate caches.

With no injected texture or custom loader, the default loader performs
`fetch(url, { mode: 'cors', credentials: 'same-origin', signal })`, checks HTTP
success, and decodes the response Blob using `createImageBitmap`. Use PNG or
another supported raster format for a Worker-only deployment. SVG Blob decoding
failure rejects with `TEXTURE_LOAD_FAILED`; the default path does not substitute
DOM images or blank layers. A custom decoder can use Wasm and return an owned
bitmap, but the board library does not parse arbitrary SVG/DOM. See the
[backend investigation](https://github.com/putianyi889/minesweeper-board/blob/main/src/rendering/README.md).

```ts
// Relative paths below resolve against https://example.test/app/tiles/.
const renderer = createBoardRenderer({
  assetBaseURL: 'https://example.test/app/tiles/',
  textureUrls: { up: 'up.png', down: 'down.png' },
})
```

The published Worker bundle inlines the built-in SVG URLs under
[Vite library mode](https://vite.dev/config/build-options#build-assetsinlinelimit),
so those URLs need no separately deployed sprite directory. Vite source
development transforms the SVG URL imports normally. An application using
`new Worker(new URL('./board.worker.ts', import.meta.url), { type: 'module' })`
lets Vite include the Worker module in its development and production asset
graphs. The package does not create or schedule Workers.

Custom asset directories must be deployed by the application, including any
non-root `base` prefix. An explicit absolute `assetBaseURL` is recommended for
custom relative URLs so they are independent of the bundled Worker chunk's
hashed directory. Cross-origin assets need appropriate CORS headers; opaque
`no-cors` responses are not a workaround. Data/blob URLs do not need an HTTP
asset deployment, but still follow CSP and browser decoder support.

## Rendering, cancellation and parity

Inputs, defaults, board conversions, trace windows/markers, probability visibility
and styling are the same as [main-thread rendering](./rendering#input-and-coordinates).
All layers share `(0, 0)`, `Math.ceil(columns * size)`, `Math.ceil(rows * size)`
and the exact numeric `cellSize`. No device pixel ratio scaling is implicit.
Set trace `opacity: 0` for a transparent trace background; compositing opacity
and custom cursor rasterization remain caller responsibilities.

`render(input, { output?, signal? })` snapshots input before waiting, processes
one instance's requests in order, and resolves only when every selected layer
and requested bitmap is complete. It never waits for screen refreshes. Texture
loading, drawing or bitmap conversion failure rejects the whole frame and
cleans partial outputs. Failed texture cache entries can be retried.

```ts
const job = new AbortController()
const pending = renderer.render(input, { signal: job.signal })
job.abort() // pending rejects with BoardRenderError.code === 'CANCELLED'
```

Cancellation rejects a queued/active request immediately and discards its output.
Reusable shared texture loads may continue, so other requests can reuse them.
`destroy()` also aborts the instance's lifetime signal, which aborts default fetches
and notifies custom loaders. Custom loaders should respect that signal. Returned
bitmaps arriving after destruction are closed even if a custom loader ignores it.
Both late success and late failure are observed, avoiding unhandled rejections.
Already returned frames are unaffected by later cancellation of their request.

Cancellation is cooperative: a Worker message cannot interrupt a currently
executing synchronous JavaScript/2D call. The core checks cancellation at layer
boundaries and asynchronous waits. Worker termination/preemptive job scheduling
belongs to the application.

Errors use the existing `BoardRenderError` codes plus `CANCELLED`; missing
OffscreenCanvas yields `CANVAS_UNAVAILABLE`, and missing bitmap conversion yields
`BITMAP_UNAVAILABLE`. Texture failures identify the key/URL and preserve the
underlying cause. Calls after destruction reject with `DESTROYED`.

## Resource ownership

| Resource | Before transfer/release | After transfer/release | At renderer destruction |
| --- | --- | --- | --- |
| Cached/injected texture bitmaps | Exclusively owned by the instance; do not share, close or transfer them. | Never transferred as frame outputs. | Closed, including unused injected entries and late loader results. |
| Frame ImageBitmap, not transferred | Owned by that frame; subsequent renders cannot overwrite it. | `release()` closes it exactly once. | Still valid until the caller releases it. |
| Frame ImageBitmap, transferred successfully | Sender handle becomes detached; receiver owns its new handle. | Sender `release()` closes only detached handles and cannot close recipient resources. Receiver closes after consumption. | Sender destruction cannot invalidate recipient resources. |
| OffscreenCanvas output | Read-only leased buffer in this realm. | `release()` permits reuse/overwrite; the source reference becomes invalid. | Held frames remain valid until release; idle buffers are cleared. |

For bitmap output, the core uses
[`transferToImageBitmap()`](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/transferToImageBitmap)
to detach each completed layer from its drawing buffer. The reusable buffer gets
new storage, while the bitmap is an independent frame resource. `postMessage`
with its transfer list moves ownership between realms without sending a full
RGBA array. If posting fails, `finally { frame.release() }` closes the still-local
handles. Partial transfers/local copies require the caller to close every handle
it still owns. Do not send a bitmap more than once or reuse it after transfer.

OffscreenCanvas output is available with `{ output: 'canvas' }` and fully typed as
`WorkerRenderFrame<OffscreenCanvas>`. **Do not transfer, resize, mutate or call
`transferToImageBitmap()` on a leased canvas.** Use bitmap output for transfers,
or make an independently owned copy. Release only after local asynchronous
consumers finish. The pool retains at most one idle canvas per layer; holding
many unreleased frames is a caller-owned memory cost.

`release()` and `destroy()` are idempotent. Destroying an instance does not close
already returned untransferred frame bitmaps or leased canvases; those still
require release. Terminating a Worker is not a replacement for closing bitmap
handles already received by another thread.

## Verification and scope

```sh
npm run lintfix
npm run test
npm run build
npm run typecheck:worker
npm run test:worker:build
node tests/worker-browser.mjs
```

The declaration check imports the published `/worker` entry with only `ES2022`
and `WebWorker` libraries, no DOM/Vue type libraries. The integration fixture
imports the actual package exports and uses two native module Workers. The
browser runner checks Vite development and production under `/export/`, texture
pixels, alpha, transferred output survival after sender release/destruction,
instance isolation and probability/trace pixel parity. Set `WORKER_TEST_BROWSER`
to a Chrome/Edge executable if the default installation paths do not apply.
These checks use no Cypress. Unit tests separately cover cancellation, errors,
late-result cleanup, texture caching and canvas leases.

No SharedArrayBuffer, cross-origin isolation, Worker pool, replay parser, WASM
sharing, compositing, crop, encoding or download is provided. Native performance
depends on the workload; these correctness checks do not establish a speedup.
