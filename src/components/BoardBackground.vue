<template>
    <ImageGrid
        ref="imageGrid"
        :cell-height="context.size.value"
        :cell-width="context.size.value"
        :cells="cells"
        :images="images"
    />
</template>

<script setup lang="ts">
import { computed, inject, ref, unref } from 'vue'
import type { PropType, Ref, ShallowRef } from 'vue'
import { ImageGrid } from '@putianyi888/vue3-plots'
import celldown from '../assets/celldown.svg?url'
import cellup from '../assets/cellup.svg?url'
import { minesweeperBoardKey } from './context'

type CellIndex = {
    rowIndex: number
    columnIndex: number
}
type ImageGridExpose = {
    cellIndex?: CellIndex | Ref<CellIndex | undefined> | ShallowRef<CellIndex | undefined>
}

const props = defineProps({
    /** Background matrix. true renders a down cell, false renders an up cell. */
    board: { type: Array as PropType<boolean[][]>, default: undefined },
})

const context = inject(minesweeperBoardKey)
if (context === undefined) {
    throw new Error('BoardBackground must be used inside MinesweeperBoard.')
}

const images = {
    down: celldown,
    up: cellup,
}
const downValues = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 18])
const backgroundBoard = computed(() => {
    if (props.board !== undefined) {
        return props.board
    }
    const source = context.board.value
    if (source === undefined) {
        throw new Error('BoardBackground requires a board prop or MinesweeperBoard board context.')
    }
    return source.map((row) => row.map((cell) => downValues.has(cell)))
})
const cells = computed(() => backgroundBoard.value.map((row) => row.map((cell) => (cell ? 'down' : 'up'))))

const imageGrid = ref<ImageGridExpose>()
const cellIndex = computed(() => unref(imageGrid.value?.cellIndex))

defineExpose({ cellIndex })
</script>
