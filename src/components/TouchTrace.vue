<template>
    <svg
        class="minesweeper-touch-trace"
        :width="columns * cellSize"
        :height="rows * cellSize"
        :viewBox="`0 0 ${columns || 1} ${rows || 1}`"
        :style="{ color }"
        aria-hidden="true"
    >
        <rect width="100%" height="100%" fill="black" :opacity="clampTraceOpacity(opacity)" />
        <g fill="none" stroke="currentColor" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round">
            <path v-for="contact in contacts" :key="contact.id" v-memo="[contact.path]" :data-touch-path="contact.id" :d="contact.path" />
        </g>
        <g v-if="resolvedDownMarker">
            <TraceMarker
                v-for="contact in contacts" :key="contact.id"
                :marker="resolvedDownMarker" :row="contact.down.row" :column="contact.down.column"
                :data-touch-down="contact.id"
            />
        </g>
        <g v-if="resolvedActiveMarker">
            <TraceMarker
                v-for="contact in activeContacts" :key="contact.id"
                :marker="resolvedActiveMarker" :row="contact.position.row" :column="contact.position.column"
                :data-touch-active="contact.id"
            />
        </g>
    </svg>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, shallowRef, triggerRef, watch } from 'vue'
import type { PropType } from 'vue'
import { minesweeperBoardKey } from './context'
import { defaultTouchTraceActiveMarker, defaultTouchTraceDownMarker } from './touchTrace'
import type { TouchTraceEvent, TouchTraceMarker } from './touchTrace'
import TraceMarker from './TraceMarker.vue'
import { TouchTraceModel } from '../rendering/touchTrace'
import { clampTraceOpacity, resolveTraceMarker } from '../rendering/traceMarker'

const props = defineProps({
    events: { type: Array as PropType<readonly TouchTraceEvent[]>, required: true },
    /** Number of processed events; exclusive, defaults to events.length. */
    endIndex: { type: Number, default: undefined },
    lineWidth: { type: Number, default: 0.08 },
    color: { type: String, default: 'currentColor' },
    /** Opacity of the black background mask, independently of paths and markers. */
    opacity: { type: Number, default: 0.2 },
    downMarker: { type: [Object, Boolean] as PropType<TouchTraceMarker | false>, default: undefined },
    activeMarker: { type: [Object, Boolean] as PropType<TouchTraceMarker | false>, default: undefined },
})

const context = inject(minesweeperBoardKey)
if (!context) throw new Error('TouchTrace must be used inside MinesweeperBoard.')
const boardContext = context
const model = new TouchTraceModel()
const contacts = shallowRef(model.contacts)
const activeContacts = shallowRef(model.activeContacts)
const cellSize = computed(() => boardContext.size.value)
const rows = computed(() => boardContext.board.value?.length ?? inferredBounds.value.rows)
const columns = computed(() => boardContext.board.value?.reduce((max, row) => Math.max(max, row.length), 0) ?? inferredBounds.value.columns)
const inferredBounds = computed(() => {
    let rows = 0, columns = 0
    for (const event of props.events) {
        if (Number.isFinite(event.row)) rows = Math.max(rows, Math.ceil(event.row))
        if (Number.isFinite(event.column)) columns = Math.max(columns, Math.ceil(event.column))
    }
    return { rows, columns }
})
const strokeWidth = computed(() => Number.isFinite(props.lineWidth) ? Math.max(0, props.lineWidth) : 0)
const resolvedDownMarker = computed(() => resolveTraceMarker(props.downMarker, defaultTouchTraceDownMarker))
const resolvedActiveMarker = computed(() => resolveTraceMarker(props.activeMarker, defaultTouchTraceActiveMarker))

function seek() {
    model.seek(props.events, props.endIndex)
    triggerRef(contacts)
    activeContacts.value = model.activeContacts
}

// Keep this deep watcher separate: changing only endIndex must not traverse the event history.
watch(() => props.events, () => { model.reset(); seek() }, { deep: true, immediate: true })
watch(() => props.endIndex, seek)
onBeforeUnmount(() => model.reset())

defineExpose({ cellSize })
</script>

<style scoped>
.minesweeper-touch-trace {
    display: block;
    overflow: hidden;
    pointer-events: none;
}
</style>
