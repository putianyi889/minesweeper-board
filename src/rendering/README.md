# Worker backend investigation

The existing `vue3-plots` ImageGrid renderer is component-oriented and uses DOM
images/canvases. It does not supply a DOM-free, transferable frame API, so both
board backends now use `core.ts` and the existing board painters directly. This
keeps board conversions, index windows, probability styles and ownership in one
implementation, while platform-specific loading and canvas allocation stay in
`domBackend.ts` and the Worker entry.

Native APIs cover OffscreenCanvas drawing and transferring ImageBitmap outputs:
[OffscreenCanvas.transferToImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/transferToImageBitmap),
[transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects).
They require neither SharedArrayBuffer nor cross-origin isolation.

Our assets are SVGs. The native `createImageBitmap(Blob)` path cannot be assumed
to decode SVG in every browser; Chromium has a documented
[SVG Blob decoding issue](https://issues.chromium.org/issues/40269670).
This is a compatibility boundary, not permission to return a missing layer.
The default Worker loader therefore rejects native decode failures explicitly.
For the bundled assets, use `loadWorkerBoardTextures()` on the main thread once
per Worker initialization, then transfer the resulting rasterized bitmaps into
that instance. No visible Vue board is mounted or updated during preparation.
The Worker itself remains DOM-free. Applications may instead deploy PNG textures
or supply an owned-bitmap loader inside the Worker.

An alternative is a Wasm SVG rasterizer such as
[resvg-wasm](https://github.com/thx/resvg-js#webassembly). It is mature but adds a
Wasm binary, initialization and a font/resource configuration surface that this
board library does not otherwise need. Decoded-resource injection uses existing
browser APIs and the request's allowed injection path, so we have not added a
general SVG parser or rasterizer dependency. A caller can still use resvg in
`loadTexture` if it needs fully Worker-local SVG decoding.

The shipped library bundles its URL assets inline under
[Vite library mode](https://vite.dev/config/build-options#build-assetsinlinelimit).
Source development also works with Vite's asset URL transformation. Custom
relative URLs resolve against `assetBaseURL` or the Worker entry module URL;
they do not resolve against a page's document base. See the public Worker guide
for CORS, resource ownership and deployment examples.

Tests distinguish mocks, a Worker-only declaration check, Vite consumer builds
and native browser checks. No speedup is inferred: profiling, Worker count,
scheduling, ordering and encoding belong to the caller.
