# Example

This example uses `ms-toollib` as the minesweeper backend and `@putianyi888/vue3-minesweeper-board` as the interactive frontend.

<script setup>
import MinesweeperExample from './components/MinesweeperExample.vue'
</script>

<ClientOnly>
  <MinesweeperExample />
</ClientOnly>

## Source

::: code-group

<<< ./components/MinesweeperExample.vue#template [template]

<<< ./components/MinesweeperExample.vue#board-display{ts} [board display]

<<< ./components/MinesweeperExample.vue#event-handler{ts} [event handler]

<<< ./components/MinesweeperExample.vue#timer{ts} [timer]

<<< ./components/MinesweeperExample.vue#style [style]

:::
