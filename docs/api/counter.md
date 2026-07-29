# Counter

`Counter` renders a numeric display using the SVG digits from
`src/assets/counter`. Its beveled frame is implemented with CSS.

## Props

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
