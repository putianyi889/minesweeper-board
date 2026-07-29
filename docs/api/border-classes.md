# Border Classes

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
