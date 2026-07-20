# Guide

## Install

```sh
npm install @putianyi888/vue3-minesweeper-board vue
```

## Usage

```vue
<script setup lang="ts">
import MinesweeperBoard from '@putianyi888/vue3-minesweeper-board'

const board = [
  [10, 10, 10, 10],
  [1, 2, 2, 1],
  [0, 1, 15, 1],
]
</script>

<template>
  <MinesweeperBoard :board="board" :size="24" />
</template>
```

## Local Preview

This documentation imports the component from the local source tree while
developing the package.

<script setup>
import MinesweeperBoard from '../src/components/MinesweeperBoard.vue'

const demoBoard = [
  [10, 11, 12, 99],
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 14, 15, 16],
]
</script>

<ClientOnly>
  <MinesweeperBoard :board="demoBoard" :size="24" />
</ClientOnly>

## Custom Layers

`MinesweeperBoard` provides board context to its slot. Use `BoardBackground`
and `BoardForeground` directly when you want to override one layer.

```vue
<script setup lang="ts">
import { BoardBackground, BoardForeground, MinesweeperBoard } from '@putianyi888/vue3-minesweeper-board'

const foreground = [
  [0, 1, 2],
  [-2, -1, -4],
]
</script>

<template>
  <MinesweeperBoard :size="24">
    <BoardBackground :board="[[false, false, false], [true, true, true]]" />
    <BoardForeground
      :board="foreground"
      style="inset: 0; pointer-events: none; position: absolute;"
    />
  </MinesweeperBoard>
</template>
```
