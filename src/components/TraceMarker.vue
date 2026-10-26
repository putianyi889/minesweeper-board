<template>
    <g
        :transform="`translate(${column} ${row})`"
        :opacity="clampTraceOpacity(marker.opacity)"
        :fill="marker.shape === 'ring' || marker.shape === 'cross' ? 'none' : marker.fill"
        :stroke="marker.stroke"
        :stroke-width="length(marker.strokeWidth)"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path v-if="path" :d="path" />
        <circle v-else :r="length(marker.size) / 2" />
    </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MouseTraceResolvedMarker } from './mouseTrace'
import { clampTraceOpacity } from '../rendering/traceMarker'

const props = defineProps<{ marker: MouseTraceResolvedMarker; row: number; column: number }>()
const length = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0
const path = computed(() => {
    const half = length(props.marker.size) / 2
    if (props.marker.shape === 'cross') return `M ${-half} ${-half} L ${half} ${half} M ${half} ${-half} L ${-half} ${half}`
    if (props.marker.shape === 'square') return `M ${-half} ${-half} H ${half} V ${half} H ${-half} Z`
    if (props.marker.shape === 'diamond') return `M 0 ${-half} L ${half} 0 L 0 ${half} L ${-half} 0 Z`
    return undefined
})
</script>
