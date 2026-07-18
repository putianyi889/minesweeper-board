<template>
    <div
        ref="boardElement"
        class="minesweeper-board-content"
        @mouseleave="clearCellIndex"
        @mousemove="updateCellIndex"
    >
        <div class="minesweeper-board-layer">
            <slot
                name="background"
                :board="props.board"
                :size="effectiveSize"
            >
                <BoardBackground v-if="props.board !== undefined" />
            </slot>
        </div>
        <div class="minesweeper-board-layer">
            <slot
                :board="props.board"
                :cell-index="cellIndex"
                :size="effectiveSize"
            />
        </div>
        <div class="minesweeper-board-layer minesweeper-board-layer--foreground">
            <slot
                name="foreground"
                :board="props.board"
                :size="effectiveSize"
            >
                <BoardForeground v-if="props.board !== undefined" />
            </slot>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import type { PropType } from 'vue'
import BoardBackground from './BoardBackground.vue'
import BoardForeground from './BoardForeground.vue'
import { minesweeperBoardKey } from './context'

type CellIndex = {
    rowIndex: number
    columnIndex: number
}
type BoardSize = number | 'auto'

const props = defineProps({
    /** Game board matrix following ms_toollib's game_board values. */
    board: { type: Array as PropType<number[][]>, default: undefined },
    /** Side length of each cell in canvas pixels, or auto to fit the parent container. */
    size: {
        type: [Number, String] as PropType<BoardSize>,
        required: true,
        validator: (size: BoardSize) => size === 'auto' || typeof size === 'number',
    },
})

const boardElement = ref<HTMLElement>()
const cellIndex = ref<CellIndex>()
const containerSize = ref({ height: 0, width: 0 })
const rowCount = computed(() => props.board?.length ?? 0)
const columnCount = computed(() => props.board?.reduce((max, row) => Math.max(max, row.length), 0) ?? 0)
const effectiveSize = computed(() => {
    if (typeof props.size === 'number') {
        return props.size
    }

    const widthSize = columnCount.value > 0 && containerSize.value.width > 0
        ? containerSize.value.width / columnCount.value
        : undefined
    const heightSize = rowCount.value > 0 && containerSize.value.height > 0
        ? containerSize.value.height / rowCount.value
        : undefined
    const size = Math.min(...[widthSize, heightSize].filter((value): value is number => value !== undefined))
    return Number.isFinite(size) ? Math.max(1, size) : 16
})

provide(minesweeperBoardKey, {
    board: computed(() => props.board),
    size: computed(() => effectiveSize.value),
})

const boardWidth = computed(() => columnCount.value * effectiveSize.value)
const boardHeight = computed(() => rowCount.value * effectiveSize.value)

function clearCellIndex() {
    if (cellIndex.value === undefined) {
        return
    }
    cellIndex.value = undefined
}

function updateCellIndex(event: MouseEvent) {
    const element = boardElement.value
    if (element === undefined || rowCount.value === 0 || columnCount.value === 0) {
        clearCellIndex()
        return
    }

    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0 || boardWidth.value === 0 || boardHeight.value === 0) {
        clearCellIndex()
        return
    }

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    if (x < 0 || y < 0 || x >= boardWidth.value || y >= boardHeight.value) {
        clearCellIndex()
        return
    }

    const rowIndex = Math.floor(y / effectiveSize.value)
    const columnIndex = Math.floor(x / effectiveSize.value)
    if (props.board?.[rowIndex]?.[columnIndex] === undefined) {
        clearCellIndex()
        return
    }

    setCellIndex({ rowIndex, columnIndex })
}

function setCellIndex(nextCellIndex: CellIndex) {
    if (
        cellIndex.value?.rowIndex === nextCellIndex.rowIndex &&
        cellIndex.value.columnIndex === nextCellIndex.columnIndex
    ) {
        return
    }

    cellIndex.value = nextCellIndex
}

let resizeObserver: ResizeObserver | undefined

function updateContainerSize() {
    const element = boardElement.value
    const container = element?.parentElement ?? element
    if (container === undefined) {
        containerSize.value = { height: 0, width: 0 }
        return
    }

    const rect = container.getBoundingClientRect()
    containerSize.value = { height: rect.height, width: rect.width }
}

function observeContainer() {
    resizeObserver?.disconnect()
    resizeObserver = undefined
    if (props.size !== 'auto') {
        return
    }

    const element = boardElement.value
    const container = element?.parentElement ?? element
    if (container === undefined) {
        return
    }

    updateContainerSize()
    if (typeof ResizeObserver === 'undefined') {
        return
    }

    resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry === undefined) {
            updateContainerSize()
            return
        }
        containerSize.value = {
            height: entry.contentRect.height,
            width: entry.contentRect.width,
        }
    })
    resizeObserver.observe(container)
}

onMounted(() => {
    observeContainer()
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
})

watch(() => props.size, () => {
    observeContainer()
})

defineExpose({ cellIndex })
</script>

<style scoped>
.minesweeper-board-content {
    display: grid;
    font-size: initial;
    line-height: 0;
}

.minesweeper-board-layer {
    grid-area: 1 / 1;
}

.minesweeper-board-layer--foreground {
    pointer-events: none;
}
</style>
