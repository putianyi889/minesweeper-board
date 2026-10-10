<template>
    <canvas
        ref="canvasElement"
        class="minesweeper-board-probability"
        :height="canvasHeight"
        :width="canvasWidth"
        aria-hidden="true"
    />
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import { minesweeperBoardKey } from './context'
import { cloneMatrix, hasShapeChanged } from './utils'

import { drawProbabilityCell } from '../rendering/probability'
import type { ProbabilityColor } from '../rendering/probability'
import { getLayerSourceBoard, useLayerRenderer } from '../rendering/useLayerRenderer'

const props = defineProps({
    /** Probability matrix. Values are expected to be between 0 and 1. */
    board: { type: Array as PropType<number[][]>, required: true },
    /** Maps a probability value to the text color used for that cell. */
    color: {
        type: Function as PropType<ProbabilityColor>,
        default: () => '#000000',
    },
})

const context = inject(minesweeperBoardKey)
if (context === undefined) {
    throw new Error('BoardProbability must be used inside MinesweeperBoard.')
}
const boardContext = context

const canvasElement = ref<HTMLCanvasElement>()
const rowCount = computed(() => (boardContext.board.value ?? props.board).length)
const columnCount = computed(() => (boardContext.board.value ?? props.board).reduce((max, row) => Math.max(max, row.length), 0))
const canvasWidth = computed(() => columnCount.value * boardContext.size.value)
const canvasHeight = computed(() => rowCount.value * boardContext.size.value)
const sourceBoard = computed(() => boardContext.board.value)

let previousBoard: number[][] = []
let previousSourceBoard: number[][] | undefined

function getCanvasContext() {
    return canvasElement.value?.getContext('2d') ?? undefined
}

function renderAllCells() {
    const context2d = getCanvasContext()
    if (context2d === undefined) {
        return
    }

    context2d.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
    props.board.forEach((row, rowIndex) => {
        row.forEach((value, columnIndex) => {
            renderCell(context2d, value, rowIndex, columnIndex)
        })
    })
    previousBoard = cloneMatrix(props.board)
    previousSourceBoard = cloneOptionalMatrix(sourceBoard.value)
}

function renderChangedCells() {
    const context2d = getCanvasContext()
    if (context2d === undefined) {
        return
    }
    if (
        hasShapeChanged(props.board, previousBoard) ||
        hasOptionalShapeChanged(sourceBoard.value, previousSourceBoard)
    ) {
        renderAllCells()
        return
    }

    props.board.forEach((row, rowIndex) => {
        row.forEach((value, columnIndex) => {
            if (
                previousBoard[rowIndex]?.[columnIndex] !== value ||
                sourceBoard.value?.[rowIndex]?.[columnIndex] !== previousSourceBoard?.[rowIndex]?.[columnIndex]
            ) {
                renderCell(context2d, value, rowIndex, columnIndex)
            }
        })
    })
    previousBoard = cloneMatrix(props.board)
    previousSourceBoard = cloneOptionalMatrix(sourceBoard.value)
}

function renderCell(context2d: CanvasRenderingContext2D, value: number, rowIndex: number, columnIndex: number) {
    drawProbabilityCell(context2d, value, rowIndex, columnIndex, boardContext.size.value, sourceBoard.value, props.color)
}

function cloneOptionalMatrix(matrix: number[][] | undefined) {
    return matrix === undefined ? undefined : cloneMatrix(matrix)
}

function hasOptionalShapeChanged(nextMatrix: number[][] | undefined, priorMatrix: number[][] | undefined) {
    if (nextMatrix === undefined || priorMatrix === undefined) {
        return nextMatrix !== priorMatrix
    }
    return hasShapeChanged(nextMatrix, priorMatrix)
}

onMounted(() => {
    renderAllCells()
})

watch([() => props.board, sourceBoard], () => {
    renderChangedCells()
}, { deep: true, flush: 'post' })

watch([
    () => boardContext.size.value,
    () => props.color,
    rowCount,
    columnCount,
], () => {
    renderAllCells()
}, { flush: 'post' })
const cellSize = computed(() => boardContext.size.value)
const render = useLayerRenderer('probability', () => ({
    board: getLayerSourceBoard(sourceBoard.value, props.board),
    size: cellSize.value,
    layers: { background: false, foreground: false, probability: { board: props.board, color: props.color } },
}))

defineExpose({ cellSize, render })
</script>

<style scoped>
.minesweeper-board-probability {
    display: block;
    pointer-events: none;
}
</style>
