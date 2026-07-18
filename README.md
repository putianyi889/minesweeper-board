# @putianyi888/vue3-minesweeper-board

Vue 3 component for rendering a Minesweeper board matrix using
`@putianyi888/vue3-plots`.

## Install

```sh
npm install @putianyi888/vue3-minesweeper-board @putianyi888/vue3-plots vue
```

## Usage

```vue
<script setup lang="ts">
import MinesweeperBoard from '@putianyi888/vue3-minesweeper-board'

const board = [
  [10, 10, 10],
  [1, 2, 1],
  [0, 0, 0],
]
</script>

<template>
  <MinesweeperBoard :board="board" :size="24" />
</template>
```

`board` follows `ms_toollib` game board values. Unsupported values render as
an unopened background cell with a blank foreground.

You can also import the lower-level layers:

```ts
import { BoardBackground, BoardForeground, Counter, MinesweeperBoard } from '@putianyi888/vue3-minesweeper-board'
```

```vue
<Counter :value="12.34" :fixed="2" :digits="3" :size="24" />
```
