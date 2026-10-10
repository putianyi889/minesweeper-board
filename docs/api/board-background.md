# BoardBackground

## Canvas / Bitmap Output

Template refs expose `cellSize` and asynchronous `render(options?)`. The returned
snapshot preserves alpha and shares the source board's extent and coordinates
with the other layers. See [rendering](./rendering#component-outputs) for completion,
ownership, bitmap output and release rules. `cellIndex` remains available.

## Props

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `board` | `boolean[][]` | No | `true` renders `celldown.svg`; `false` renders `cellup.svg`. When omitted, values are derived from `MinesweeperBoard` context. |

## Context Conversion

| Source Value | Background |
| --- | --- |
| `0` - `8`, `14`, `15`, `18` | `true` |
| `10`, `11`, `12`, `16` | `false` |
