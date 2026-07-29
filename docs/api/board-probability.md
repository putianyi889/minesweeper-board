# BoardProbability

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

## Props

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `board` | `number[][]` | Yes | Probability matrix. Values are expected to be between `0` and `1`; displayed values are rounded to `0` - `100` without a percent sign. |
| `color` | `(value: number, rowIndex: number, columnIndex: number) => string` | No | Maps each probability value to its text color. Defaults to black. |
