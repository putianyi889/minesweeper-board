<template>
    <div class="touch-example" :class="{ dark }">
        <div class="touch-controls">
            <button @click="endIndex = Math.max(0, endIndex - 1)">Previous</button>
            <button @click="endIndex = Math.min(events.length, endIndex + 1)">Next</button>
            <button @click="cleared = !cleared">{{ cleared ? 'Load recording' : 'Clear recording' }}</button>
            <label>Transpose <input v-model="transposed" type="checkbox"></label>
            <label>Dark <input v-model="dark" type="checkbox"></label>
        </div>
        <label>Processed events: {{ endIndex }} / {{ events.length }}
            <input v-model.number="endIndex" type="range" min="0" :max="events.length">
        </label>
        <label>Cell size: {{ size }}px <input v-model.number="size" type="range" min="20" max="64" step="0.5"></label>
        <MinesweeperBoard :board="board" :size="size">
            <TouchTrace :events="events" :end-index="endIndex" :opacity="0" color="var(--touch-color)" :active-marker="{ stroke: 'var(--touch-background)' }" />
        </MinesweeperBoard>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { MinesweeperBoard, TouchTrace } from '@putianyi888/vue3-minesweeper-board'
import type { TouchTraceEvent } from '@putianyi888/vue3-minesweeper-board'

const source: readonly TouchTraceEvent[] = [
    { id: 10, row: 0.5, column: 0.5, action: 'down' },
    { id: 20, row: 1.5, column: 1.5, action: 'down' },
    { id: 10, row: 0.5, column: 2.5, action: 'move' },
    { id: 20, row: 1.5, column: 1.5, action: 'up' },
    { id: 10, row: 0.5, column: 2.5, action: 'cancel' },
    { id: 30, row: 2.5, column: 2.5, action: 'down' },
]
const endIndex = ref(3)
const size = ref(40)
const transposed = ref(false)
const dark = ref(false)
const cleared = ref(false)
const board = Array.from({ length: 3 }, () => [10, 10, 10])
const events = computed(() => cleared.value ? [] : transposed.value
    ? source.map((event) => ({ ...event, row: event.column, column: event.row })) : source)
</script>

<style scoped>
.touch-example {
    --touch-color: #145dc4;
    --touch-background: #fff;
    background: var(--touch-background);
    color: var(--touch-color);
    padding: 1rem;
}
.touch-example.dark { --touch-color: #6bb5ff; --touch-background: #25252a; }
.touch-controls { display: flex; flex-wrap: wrap; gap: 0.75rem; }
label { display: inline-block; margin: 0.5rem; }
button { border: 1px solid currentColor; padding: 0.25rem 0.5rem; }
</style>
