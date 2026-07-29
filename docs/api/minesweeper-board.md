# MinesweeperBoard

## Props

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `board` | `number[][]` | No | Game board matrix following `ms_toollib` game board values. When provided, the default background and foreground layers are rendered. |
| `size` | `number \| 'auto'` | Yes | Rendered size of a `160x160` cell asset in pixels. Use `'auto'` to fit the board inside the parent container. |
| `cursorPosition` | `{ rowIndex: number; columnIndex: number }` | No | Cursor position in cell units. Fractional values place the cursor between cells. |

## Expose

| Name | Type | Description |
| --- | --- | --- |
| `cellIndex` | `{ rowIndex: number; columnIndex: number } \| undefined` | Current mouse position as cell indexes. Undefined when the mouse is outside a valid cell. |

## Slots

| Name | Position | Fallback |
| --- | --- | --- |
| `background` | Board area, below the default slot | `BoardBackground` |
| default | Board area, between background and foreground | None |
| `foreground` | Board area, above the default slot | `BoardForeground` |
| `cursor` | Board area, above foreground | Black bordered yellow dot |

The `cursor` slot receives `{ position, size }`. The slot layer is translated to
`cursorPosition`, with `position` measured in cells and `size` measured in pixels.
