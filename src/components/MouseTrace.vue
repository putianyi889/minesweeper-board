<template>
    <canvas
        ref="canvasElement"
        class="minesweeper-mouse-trace"
        :height="canvasHeight"
        :width="canvasWidth"
        aria-hidden="true"
    />
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import { minesweeperBoardKey } from './context'
import { defaultMouseTraceMarkers } from './mouseTrace'
import { createMouseTracePainter } from '../rendering/mouseTrace'
import { useLayerRenderer } from '../rendering/useLayerRenderer'
import type {
    MouseTraceColor,
    MouseTraceEvent,
    MouseTraceMarkerAction,
    MouseTraceMarkers,
} from './mouseTrace'

type CanvasRect = {
    height: number
    width: number
    x: number
    y: number
}

const props = defineProps({
    /** Mouse event sequence. Rows and columns are measured in cells. */
    events: { type: Array as PropType<MouseTraceEvent[]>, required: true },
    /** Inclusive start index into events. */
    startIndex: { type: Number, default: 0 },
    /** Exclusive end index into events. Defaults to events.length. */
    endIndex: { type: Number, default: undefined },
    /** Trace color by mouse button state. */
    color: {
        type: Object as PropType<Partial<MouseTraceColor>>,
        default: () => ({}),
    },
    /** Marker style overrides. Set an action to false to hide that marker. */
    markers: {
        type: Object as PropType<MouseTraceMarkers>,
        default: () => ({}),
    },
    /** Opacity of the pure black trace background. */
    opacity: { type: Number, default: 0.2 },
    /** Trace line width in cell units. */
    lineWidth: { type: Number, default: 0.08 },
})

const context = inject(minesweeperBoardKey)
if (context === undefined) {
    throw new Error('MouseTrace must be used inside MinesweeperBoard.')
}
const boardContext = context

const canvasElement = ref<HTMLCanvasElement>()
const fallbackRowCount = computed(() => getFallbackRowCount(props.events))
const fallbackColumnCount = computed(() => getFallbackColumnCount(props.events))
const rowCount = computed(() => boardContext.board.value?.length ?? fallbackRowCount.value)
const columnCount = computed(() => {
    return boardContext.board.value?.reduce((max, row) => Math.max(max, row.length), 0) ?? fallbackColumnCount.value
})
const canvasWidth = computed(() => columnCount.value * boardContext.size.value)
const canvasHeight = computed(() => rowCount.value * boardContext.size.value)
const startIndex = computed(() => clampIndex(props.startIndex, 0, props.events.length))
const endIndex = computed(() => clampIndex(props.endIndex ?? props.events.length, startIndex.value, props.events.length))

let renderedEvents: MouseTraceEvent[] | undefined
let renderedEventsSnapshot: MouseTraceEvent[] = []
let renderedStartIndex = 0
let renderedEndIndex = 0

function getCanvasContext() {
    return canvasElement.value?.getContext('2d') ?? undefined
}

function renderAll() {
    const context2d = getCanvasContext()
    if (context2d === undefined) {
        return
    }

    context2d.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
    fillBackground(context2d, getCanvasRect())
    drawRange(context2d, startIndex.value, endIndex.value)
    rememberRenderedRange()
}

function renderIndexChange(previousStartIndex: number, previousEndIndex: number) {
    const context2d = getCanvasContext()
    if (context2d === undefined) {
        return
    }

    const nextStartIndex = startIndex.value
    const nextEndIndex = endIndex.value
    if (nextStartIndex === previousStartIndex && nextEndIndex >= previousEndIndex) {
        drawSegments(context2d, Math.max(nextStartIndex, previousEndIndex - 1), nextEndIndex)
        drawMarkers(context2d, previousEndIndex, nextEndIndex)
    } else if (nextEndIndex === previousEndIndex && nextStartIndex <= previousStartIndex) {
        drawSegments(context2d, nextStartIndex, Math.min(nextEndIndex, previousStartIndex + 1))
        drawMarkers(context2d, nextStartIndex, previousStartIndex)
    } else {
        renderDirtyIndexRange(
            context2d,
            Math.max(0, Math.min(previousStartIndex, nextStartIndex) - 1),
            Math.min(props.events.length, Math.max(previousEndIndex, nextEndIndex) + 1),
        )
    }
    rememberRenderedRange()
}

function renderDirtyIndexRange(context2d: CanvasRenderingContext2D, dirtyStartIndex: number, dirtyEndIndex: number) {
    const dirtyRect = getEventRangeRect(dirtyStartIndex, dirtyEndIndex)
    if (dirtyRect === undefined) {
        return
    }

    context2d.save()
    context2d.beginPath()
    context2d.rect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height)
    context2d.clip()
    context2d.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height)
    fillBackground(context2d, dirtyRect)
    for (let index = startIndex.value; index < endIndex.value - 1; index += 1) {
        const segmentRect = getSegmentRect(index)
        if (segmentRect !== undefined && intersects(dirtyRect, segmentRect)) {
            drawSegment(context2d, index)
        }
    }
    for (let index = startIndex.value; index < endIndex.value; index += 1) {
        const markerRect = getMarkerRect(index)
        if (markerRect !== undefined && intersects(dirtyRect, markerRect)) {
            drawMarker(context2d, index)
        }
    }
    context2d.restore()
}

const painter = computed(() => createMouseTracePainter(props, boardContext.size.value))

function drawRange(context2d: CanvasRenderingContext2D, start: number, end: number) {
    painter.value.drawRange(context2d, start, end)
}

function drawSegments(context2d: CanvasRenderingContext2D, start: number, end: number) {
    painter.value.drawSegments(context2d, start, end)
}

function drawSegment(context2d: CanvasRenderingContext2D, index: number) {
    painter.value.drawSegment(context2d, index)
}

function drawMarkers(context2d: CanvasRenderingContext2D, start: number, end: number) {
    painter.value.drawMarkers(context2d, start, end)
}

function drawMarker(context2d: CanvasRenderingContext2D, index: number) {
    painter.value.drawMarker(context2d, index)
}

function fillBackground(context2d: CanvasRenderingContext2D, rect: CanvasRect) {
    painter.value.fillBackground(context2d, rect)
}

function getEventPosition(event: MouseTraceEvent) {
    return painter.value.getEventPosition(event)
}

function getMarker(action: MouseTraceMarkerAction) {
    return painter.value.getMarker(action)
}

function getEventRangeRect(start: number, end: number) {
    const events = props.events.slice(start, end).filter(isFiniteEvent)
    if (events.length === 0) {
        return undefined
    }

    const margin = getDirtyMargin()
    const positions = events.map(getEventPosition)
    const minX = Math.min(...positions.map((position) => position.x)) - margin
    const minY = Math.min(...positions.map((position) => position.y)) - margin
    const maxX = Math.max(...positions.map((position) => position.x)) + margin
    const maxY = Math.max(...positions.map((position) => position.y)) + margin
    return clampRect({
        height: maxY - minY,
        width: maxX - minX,
        x: minX,
        y: minY,
    })
}

function getSegmentRect(index: number) {
    const event = props.events[index]
    const nextEvent = props.events[index + 1]
    if (event === undefined || nextEvent === undefined || !isFiniteEvent(event) || !isFiniteEvent(nextEvent)) {
        return undefined
    }

    const margin = getDirtyMargin()
    const start = getEventPosition(event)
    const end = getEventPosition(nextEvent)
    const minX = Math.min(start.x, end.x) - margin
    const minY = Math.min(start.y, end.y) - margin
    const maxX = Math.max(start.x, end.x) + margin
    const maxY = Math.max(start.y, end.y) + margin
    return {
        height: maxY - minY,
        width: maxX - minX,
        x: minX,
        y: minY,
    }
}

function getMarkerRect(index: number) {
    const event = props.events[index]
    if (event === undefined || event.action === 'mv' || !isFiniteEvent(event)) {
        return undefined
    }
    const marker = getMarker(event.action)
    if (marker === undefined) {
        return undefined
    }

    const margin = Math.max(getDirtyMargin(), marker.size * boardContext.size.value)
    const { x, y } = getEventPosition(event)
    return {
        height: margin * 2,
        width: margin * 2,
        x: x - margin,
        y: y - margin,
    }
}

function getDirtyMargin() {
    const largestMarkerSize = Math.max(...Object.values(defaultMouseTraceMarkers).map((marker) => marker.size))
    return boardContext.size.value * Math.max(largestMarkerSize, props.lineWidth, 0.25)
}

function getCanvasRect() {
    return {
        height: canvasHeight.value,
        width: canvasWidth.value,
        x: 0,
        y: 0,
    }
}

function clampRect(rect: CanvasRect) {
    // Clear and refill whole pixels so translucent backgrounds cannot accumulate at the edges.
    const x = Math.max(0, Math.floor(rect.x))
    const y = Math.max(0, Math.floor(rect.y))
    const right = Math.min(canvasWidth.value, Math.ceil(rect.x + rect.width))
    const bottom = Math.min(canvasHeight.value, Math.ceil(rect.y + rect.height))
    return {
        height: Math.max(0, bottom - y),
        width: Math.max(0, right - x),
        x,
        y,
    }
}

function intersects(first: CanvasRect, second: CanvasRect) {
    return first.x < second.x + second.width &&
        first.x + first.width > second.x &&
        first.y < second.y + second.height &&
        first.y + first.height > second.y
}

function rememberRenderedRange() {
    renderedEvents = props.events
    renderedEventsSnapshot = cloneEvents(props.events)
    renderedStartIndex = startIndex.value
    renderedEndIndex = endIndex.value
}

function cloneEvents(events: MouseTraceEvent[]) {
    return events.map((event) => ({ ...event }))
}

function hasEventContentChanged() {
    return props.events.length !== renderedEventsSnapshot.length ||
        props.events.some((event, index) => !isSameEvent(event, renderedEventsSnapshot[index]))
}

function isSameEvent(first: MouseTraceEvent, second: MouseTraceEvent | undefined) {
    return second !== undefined &&
        first.action === second.action &&
        first.column === second.column &&
        first.row === second.row &&
        first.state === second.state
}

function isFiniteEvent(event: MouseTraceEvent) {
    return Number.isFinite(event.row) && Number.isFinite(event.column)
}

function getFallbackRowCount(events: MouseTraceEvent[]) {
    return Math.max(0, ...events.filter(isFiniteEvent).map((event) => Math.ceil(event.row + 1)))
}

function getFallbackColumnCount(events: MouseTraceEvent[]) {
    return Math.max(0, ...events.filter(isFiniteEvent).map((event) => Math.ceil(event.column + 1)))
}

function clampIndex(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min
    }
    return Math.min(max, Math.max(min, Math.trunc(value)))
}

onMounted(() => {
    renderAll()
})

watch([() => props.events, startIndex, endIndex], () => {
    if (props.events !== renderedEvents || hasEventContentChanged()) {
        renderAll()
        return
    }
    renderIndexChange(renderedStartIndex, renderedEndIndex)
}, { deep: true, flush: 'post' })

watch([
    () => props.color,
    () => props.lineWidth,
    () => props.markers,
    () => props.opacity,
    () => boardContext.size.value,
    rowCount,
    columnCount,
], () => {
    renderAll()
}, { deep: true, flush: 'post' })
const cellSize = computed(() => boardContext.size.value)
const render = useLayerRenderer('mouseTrace', () => ({
    board: boardContext.board.value ?? Array.from({ length: rowCount.value }, () => Array<number>(columnCount.value).fill(10)),
    size: cellSize.value,
    layers: { background: false, foreground: false, mouseTrace: { ...props } },
}))

defineExpose({ cellSize, render })
</script>

<style scoped>
.minesweeper-mouse-trace {
    display: block;
    pointer-events: none;
}
</style>
