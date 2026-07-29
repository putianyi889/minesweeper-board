# BoardBackground

## Props

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `board` | `boolean[][]` | No | `true` renders `celldown.svg`; `false` renders `cellup.svg`. When omitted, values are derived from `MinesweeperBoard` context. |

## Context Conversion

| Source Value | Background |
| --- | --- |
| `0` - `8`, `14`, `15`, `18` | `true` |
| `10`, `11`, `12`, `16` | `false` |
