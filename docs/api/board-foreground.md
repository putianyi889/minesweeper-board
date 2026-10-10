# BoardForeground

## Canvas / Bitmap Output

Template refs expose `cellSize` and asynchronous `render(options?)`. Blank cells
remain transparent in the detached output. See
[rendering](./rendering#component-outputs) for shared coordinates, completion,
ownership, bitmap output and release rules.

## Props

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `board` | `number[][]` | No | Foreground matrix. When omitted, values are derived from `MinesweeperBoard` context. |

## Foreground Values

| Value | Asset |
| --- | --- |
| `0` | `null.svg` |
| `1` - `8` | `num1.svg` - `num8.svg` |
| `-1` | `mine.svg` |
| `-2` | `flag.svg` |
| `-3` | `falsemine.svg` |
| `-4` | `blast.svg` |

## Context Conversion

| Value | Cell |
| --- | --- |
| `0` - `8` | Same value |
| `10` | `0` |
| `11` | `-2` |
| `12` | `0` |
| `14` | `-3` |
| `15` | `-4` |
| `16` | `-1` |
| `18` | `0` |
