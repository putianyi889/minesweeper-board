<template>
    <ImageGrid
        :cell-height="context.size.value"
        :cell-width="context.size.value"
        :cells="cells"
        :images="images"
    />
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { PropType } from 'vue'
import { ImageGrid } from '@putianyi888/vue3-plots'
import { foregroundImages as images, getForegroundBoard, getForegroundKey } from '../rendering/tiles'
import { getLayerSourceBoard, useLayerRenderer } from '../rendering/useLayerRenderer'
import { minesweeperBoardKey } from './context'

const props = defineProps({
    /** Foreground matrix. Uses 0 for blank, 1-8 for numbers, and negative values for mine states. */
    board: { type: Array as PropType<number[][]>, default: undefined },
})

const context = inject(minesweeperBoardKey)
if (context === undefined) {
    throw new Error('BoardForeground must be used inside MinesweeperBoard.')
}

const foregroundBoard = computed(() => {
    if (props.board !== undefined) {
        return props.board
    }
    const source = context.board.value
    if (source === undefined) {
        throw new Error('BoardForeground requires a board prop or MinesweeperBoard board context.')
    }
    return getForegroundBoard(source)
})
const cells = computed(() => foregroundBoard.value.map((row) => row.map((cell) => getForegroundKey(cell))))
const cellSize = computed(() => context.size.value)
const render = useLayerRenderer('foreground', () => ({
    board: getLayerSourceBoard(context.board.value, foregroundBoard.value),
    size: cellSize.value,
    layers: { background: false, foreground: { board: foregroundBoard.value } },
}))

defineExpose({ cellSize, render })
</script>
