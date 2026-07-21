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

type ProbabilityColor = (value: number, rowIndex: number, columnIndex: number) => string

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
const rowCount = computed(() => props.board.length)
const columnCount = computed(() => props.board.reduce((max, row) => Math.max(max, row.length), 0))
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
    const size = boardContext.size.value
    const x = columnIndex * size
    const y = rowIndex * size
    const probability = normalizeProbability(value)

    context2d.clearRect(x, y, size, size)
    if (!shouldDisplayProbability(rowIndex, columnIndex)) {
        return
    }

    const text = String(Math.round(probability * 100))
    context2d.fillStyle = props.color(probability, rowIndex, columnIndex)
    context2d.font = `${getProbabilityFontSize(size, text)}px sans-serif`
    context2d.textAlign = 'center'
    context2d.textBaseline = 'middle'
    context2d.fillText(text, x + size / 2, y + size / 2)
}

function getProbabilityFontSize(size: number, text: string) {
    return Math.max(1, size * (text === '100' ? 0.42 : 0.54))
}

function shouldDisplayProbability(rowIndex: number, columnIndex: number) {
    const sourceCell = sourceBoard.value?.[rowIndex]?.[columnIndex]
    switch (sourceCell) {
        case undefined:
        case 10:
        case 12:
        case 18:
            return true
        default:
            return false
    }
}

function normalizeProbability(value: number) {
    if (!Number.isFinite(value)) {
        return 0
    }
    return Math.min(1, Math.max(0, value))
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
</script>

<style scoped>
.minesweeper-board-probability {
    display: block;
    pointer-events: none;
}
</style>
