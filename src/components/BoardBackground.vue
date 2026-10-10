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
import { backgroundImages as images, getBackgroundBoard } from '../rendering/tiles'
import { getLayerSourceBoard, useLayerRenderer } from '../rendering/useLayerRenderer'
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

const backgroundBoard = computed(() => {
    if (props.board !== undefined) {
        return props.board
    }
    const source = context.board.value
    if (source === undefined) {
        throw new Error('BoardBackground requires a board prop or MinesweeperBoard board context.')
    }
    return getBackgroundBoard(source)
})
const cells = computed(() => backgroundBoard.value.map((row) => row.map((cell) => (cell ? 'down' : 'up'))))

const imageGrid = ref<ImageGridExpose>()
const cellIndex = computed(() => unref(imageGrid.value?.cellIndex))

const cellSize = computed(() => context.size.value)
const render = useLayerRenderer('background', () => ({
    board: getLayerSourceBoard(context.board.value, backgroundBoard.value),
    size: cellSize.value,
    layers: { background: { board: backgroundBoard.value }, foreground: false },
}))

defineExpose({ cellIndex, cellSize, render })
</script>
