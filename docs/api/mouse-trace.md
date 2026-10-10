# MouseTrace

## Canvas / Bitmap Output

Template refs expose `cellSize` and asynchronous `render(options?)`. Export uses
the same line and marker painter as the visible layer; set `opacity="0"` for a
transparent trace background. See [rendering](./rendering#component-outputs) for
completion, shared coordinates, ownership, bitmap output and release rules.

`MouseTrace` is an optional canvas layer for rendering mouse paths and click
markers. Place it in the default slot:

```vue
<MinesweeperBoard :board="board" :size="24">
  <MouseTrace :events="events" :start-index="0" :end-index="events.length" />
</MinesweeperBoard>
```

Mouse events use cell-unit coordinates, matching `cursorPosition`. Integer
`row` and `column` values are rendered on grid lines; use `.5` for cell centers.

```ts
type MouseTraceEvent = {
  row: number
  column: number
  state: 'uu' | 'du' | 'ud' | 'dd'
  action: 'mv' | 'lc' | 'lr' | 'rc' | 'rr'
}
```

The component treats `endIndex` as exclusive. When only the index window changes,
it updates the canvas incrementally. Event array changes, in-place event changes,
size changes, color changes, marker changes, or opacity changes redraw the full
layer.

## Props

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `events` | `MouseTraceEvent[]` | Yes | Full mouse event sequence. |
| `startIndex` | `number` | No | Inclusive start index. Defaults to `0`. |
| `endIndex` | `number` | No | Exclusive end index. Defaults to `events.length`. |
| `color` | `Partial<MouseTraceColor>` | No | Trace line color by mouse state. |
| `markers` | `MouseTraceMarkers` | No | Click marker overrides. Set an action to `false` to hide its marker. |
| `opacity` | `number` | No | Opacity for the pure black background. Defaults to `0.2`. |
| `lineWidth` | `number` | No | Trace line width in cell units. Defaults to `0.08`. |

## Marker

Marker configuration values are also measured in cell units:

```ts
type MouseTraceMarker = {
  shape?: 'circle' | 'ring' | 'cross' | 'square' | 'diamond'
  size?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
}
```

## Exports

The package also exports reusable MouseTrace constants:

| Name | Type |
| --- | --- |
| `mouseTraceStates` | `readonly ['uu', 'du', 'ud', 'dd']` |
| `mouseTraceActions` | `readonly ['mv', 'lc', 'lr', 'rc', 'rr']` |
| `mouseTraceMarkerActions` | `readonly ['lc', 'lr', 'rc', 'rr']` |
| `mouseTraceMarkerShapes` | `readonly ['circle', 'ring', 'cross', 'square', 'diamond']` |
| `defaultMouseTraceColor` | `MouseTraceColor` |
| `defaultMouseTraceMarkers` | `Record<MouseTraceMarkerAction, MouseTraceResolvedMarker>` |
