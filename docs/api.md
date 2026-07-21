# API

## Component

```ts
import MinesweeperBoard, {
  BoardBackground,
  BoardForeground,
  BoardProbability,
  Counter,
  innerBorderClass,
  outerBorderClass,
} from '@putianyi888/vue3-minesweeper-board'

import '@putianyi888/vue3-minesweeper-board/style.css'
```

## MinesweeperBoard Props

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `board` | `number[][]` | No | Game board matrix following `ms_toollib` game board values. When provided, the default background and foreground layers are rendered. |
| `size` | `number \| 'auto'` | Yes | Rendered size of a `160x160` cell asset in pixels. Use `'auto'` to fit the board inside the parent container. |
| `cursorPosition` | `{ rowIndex: number; columnIndex: number }` | No | Cursor position in cell units. Fractional values place the cursor between cells. |

## MinesweeperBoard Expose

| Name | Type | Description |
| --- | --- | --- |
| `cellIndex` | `{ rowIndex: number; columnIndex: number } \| undefined` | Current mouse position as cell indexes. Undefined when the mouse is outside a valid cell. |

## MinesweeperBoard Slots

| Name | Position | Fallback |
| --- | --- | --- |
| `background` | Board area, below the default slot | `BoardBackground` |
| default | Board area, between background and foreground | None |
| `foreground` | Board area, above the default slot | `BoardForeground` |
| `cursor` | Board area, above foreground | Black bordered yellow dot |

The `cursor` slot receives `{ position, size }`. The slot layer is translated to
`cursorPosition`, with `position` measured in cells and `size` measured in pixels.

## Border Classes

The package exports plain CSS classes for composing Minesweeper frames outside
`MinesweeperBoard`:

```html
<div class="outer-border" style="font-size: 16px;">
  <div class="inner-border">
    <Counter :value="10" :size="24" />
  </div>
  <div class="inner-border">
    <MinesweeperBoard :board="board" :size="24" />
  </div>
</div>
```

`outerBorderClass` is `'outer-border'`, and `innerBorderClass` is
`'inner-border'`.

The package stylesheet exports those classes. When using them directly,
import it with:

```ts
import '@putianyi888/vue3-minesweeper-board/style.css'
```

The border scales independently with `font-size`: outer and inner bevels are `0.1875em`;
outer padding and the default gap between multiple `inner-border` blocks are
`0.375em`. The wrapped content determines each inner block's width and height.

## BoardProbability Props

`BoardProbability` is an optional canvas layer. It is not loaded by
`MinesweeperBoard` automatically; place it in the default slot when needed:

```vue
<MinesweeperBoard :board="board" :size="24">
  <BoardProbability :board="probabilityBoard" />
</MinesweeperBoard>
```

It compares each new matrix against the previous matrix and redraws only cells
whose values changed. A size or color function change redraws the full layer.
When a context board is available, cells that are opened or display foreground
content are skipped.

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `board` | `number[][]` | Yes | Probability matrix. Values are expected to be between `0` and `1`; displayed values are rounded to `0` - `100` without a percent sign. |
| `color` | `(value: number, rowIndex: number, columnIndex: number) => string` | No | Maps each probability value to its text color. Defaults to black. |

## Counter Props

`Counter` renders a numeric display using the SVG digits from
`src/assets/counter`. Its beveled frame is implemented with CSS.

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `value` | `number` | Yes | Number to display. |
| `size` | `number \| 'auto'` | Yes | Rendered size of `160` source SVG units in pixels. Use the same value as `MinesweeperBoard` to preserve the original counter-to-cell proportions. |
| `fixed` | `number` | No | Number of decimal places. Defaults to `0`. Decimal digits are rendered smaller. |
| `digits` | `number` | No | Minimum number of integer digits. Defaults to `1`; high places are padded with zeroes. |

The counter keeps the source SVG aspect ratios. For example, with `size="16"`,
each full digit renders as `13x25` pixels because the digit asset is
`130x250` source units.

```vue
<Counter :value="12.34" :fixed="2" :digits="3" :size="16" />
```

## BoardBackground Props

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `board` | `boolean[][]` | No | `true` renders `celldown.svg`; `false` renders `cellup.svg`. When omitted, values are derived from `MinesweeperBoard` context. |

Context conversion:

| Source Value | Background |
| --- | --- |
| `0` - `8`, `14`, `15`, `18` | `true` |
| `10`, `11`, `12`, `16` | `false` |

## BoardForeground Props

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `board` | `number[][]` | No | Foreground matrix. When omitted, values are derived from `MinesweeperBoard` context. |

Foreground values:

| Value | Asset |
| --- | --- |
| `0` | `null.svg` |
| `1` - `8` | `num1.svg` - `num8.svg` |
| `-1` | `mine.svg` |
| `-2` | `flag.svg` |
| `-3` | `falsemine.svg` |
| `-4` | `blast.svg` |

Context conversion:

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
