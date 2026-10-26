# Touch trace implementation and validation

The [existing application SVG layer](https://github.com/eee555/open-minesweeper/blob/main/front_end/src/components/MiniGame/TouchTrace.vue)
already establishes one vector surface for all contacts, but recomputes groups
and point strings from the entire prefix whenever the playback index changes.
It also depends on the application's replay and appearance types. The library
keeps that single-SVG approach, replacing the grouping with `TouchTraceModel`,
which consumes only new events during forward playback and caches per-contact
path strings. Backward seeks/replacements rebuild the prefix. Model data is in
cell units, independent of canvas pixels and Vue.

Native [SVG paths](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/path)
and markers provide CSS colors/variables and scale through viewBox. No additional
graphics dependency, per-contact canvas, pixel snapshot history, CSS color parser
or DOM screenshot layer is needed. The existing canvas mouse painter and SVG
touch markers share marker field types, style resolution and opacity clamping.
SVG marker geometry is handled by one private `TraceMarker.vue` used for both
marker groups. The independent board renderer and Worker API remain unchanged.

The model stores one cached path and two positions per contact, plus a map of
currently active contacts. Storage grows with event/path data and contacts,
not contacts multiplied by board pixel area. Only the current recording is held.
Unmount resets caches and Vue releases the SVG tree; there are no animation
timers, global subscriptions or ImageBitmap resources to close. The caller owns
the input array.

## Reproduce

Run `npm run test`, `npm run build`, `npm run test:touch:build`, then
`npm run test:touch:browser` (native Chrome/Edge, not Cypress). The browser runner
reuses the existing Worker runner's CDP/Vite setup through `tests/native-browser.mjs`.
Unit tests count event-array reads: the model reads exactly 10,000 events for
10,000 forward seeks. A separate component counter verifies that changing only
the index does not rerun deep event traversal. Tests also include reactive
field/push/splice changes.

The native fixture runs 10,000 sequential Vue index updates, seven direct seeks
including rewinds, then 60 recording switches with unmount/remount. Measurements
use a 16×30 board, 32px cells, DPR 2, 500 contacts interleaved in pairs. After
30 and 60 switches, CDP forces GC and records DOM counts and live JS heap; after
unmount, it checks that the SVG and detached contact nodes are gone. A positive
heap delta alone does not prove a leak: VM/JIT/runtime caches can change. The
check rejects persistent node growth and a live-heap increase over 2 MB between
the warmed batches. These finite checks cannot prove absence of every leak.

## Native results (2026-10-26)

Windows x64, AMD Ryzen 7 4800H, Node 24.18.0, Chrome 155.0.8059.85, headless
with GPU disabled, DPR 2. A single run per Vite mode, not a statistical benchmark:

| Measurement | Vite development | Vite production |
| --- | ---: | ---: |
| 10,000 sequential index updates | 2,678.7 ms | 1,916.9 ms |
| Seven direct seeks / rewinds | 67.0 ms | 33.2 ms |
| SVG surfaces / Canvas elements | 1 / 0 | 1 / 0 |
| DOM nodes after 30 / 60 switches | 1,552 / 1,552 | 1,569 / 1,569 |
| Live JS heap after 30 / 60 switches | 9,818,812 / 9,837,160 bytes | 10,040,452 / 10,053,788 bytes |
| Nodes after unmount and releasing the test app | 28 | 45 |

DOM counts include the page and test runtime. There was no node growth across
the two batches; live heap increased by 18,348 / 13,336 bytes respectively,
within the measurement's stated tolerance. No contact surfaces remained after
unmount. The fixture replaces the board background/foreground slots with valid
placeholders, so it measures TouchTrace without unrelated asynchronous image
loading or default board canvases. It also drops its app reference on disposal;
retaining a Vue app can retain its last VNode tree.

Timings measure JavaScript plus Vue/SVG updates; they are not screen refresh or
FPS measurements, and do not promise a fixed playback rate on other devices.
DOM/heap checks are finite observations, not proof of leak freedom. Long single
contacts still require the browser to parse their updated SVG path; cache work
does not imply constant overall browser rendering cost per frame.
