<template>
    <div
        ref="counterElement"
        class="counter"
        :style="counterStyle"
        :aria-label="displayValue"
        role="img"
    >
        <img
            v-for="(digit, index) in integerDigits"
            :key="`integer-${index}`"
            class="counter__digit"
            :data-counter-digit="digit"
            :src="digitImages[digit]"
            alt=""
            draggable="false"
        >
        <span
            v-if="fractionDigits.length > 0"
            class="counter__fraction"
        >
            <img
                v-for="(digit, index) in fractionDigits"
                :key="`fraction-${index}`"
                class="counter__digit counter__digit--fraction"
                :data-counter-digit="digit"
                :src="digitImages[digit]"
                alt=""
                draggable="false"
            >
        </span>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import minus from '../assets/counter/counter-.svg?url'
import zero from '../assets/counter/counter0.svg?url'
import one from '../assets/counter/counter1.svg?url'
import two from '../assets/counter/counter2.svg?url'
import three from '../assets/counter/counter3.svg?url'
import four from '../assets/counter/counter4.svg?url'
import five from '../assets/counter/counter5.svg?url'
import six from '../assets/counter/counter6.svg?url'
import seven from '../assets/counter/counter7.svg?url'
import eight from '../assets/counter/counter8.svg?url'
import nine from '../assets/counter/counter9.svg?url'

type CounterDigit = '-' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type ComponentSize = number | 'auto'

defineOptions({ name: 'MinesweeperCounter' })

const props = defineProps({
    /** Number to display. */
    value: { type: Number, required: true },
    /** Rendered size for 160 source SVG units, or auto to fit the parent container. */
    size: {
        type: [Number, String] as PropType<ComponentSize>,
        required: true,
        validator: (size: ComponentSize) => size === 'auto' || typeof size === 'number',
    },
    /** Number of decimal places. */
    fixed: {
        type: Number,
        default: 0,
        validator: (value: number) => Number.isInteger(value) && value >= 0 && value <= 100,
    },
    /** Minimum number of integer digits. Pads high places with zeroes. */
    digits: {
        type: Number,
        default: 1,
        validator: (value: number) => Number.isInteger(value) && value >= 1 && value <= 100,
    },
})

const digitImages: Record<CounterDigit, string> = {
    '-': minus,
    0: zero,
    1: one,
    2: two,
    3: three,
    4: four,
    5: five,
    6: six,
    7: seven,
    8: eight,
    9: nine,
}
const fixedDigits = computed(() => Math.min(100, Math.max(0, Math.trunc(props.fixed))))
const formattedValue = computed(() => {
    const value = Number.isFinite(props.value) ? props.value : 0
    return value.toFixed(fixedDigits.value)
})
const valueParts = computed(() => formattedValue.value.split('.'))
const integerText = computed(() => padIntegerPart(valueParts.value[0] ?? '0'))
const integerDigits = computed(() => toCounterDigits(integerText.value))
const fractionDigits = computed(() => toCounterDigits(valueParts.value[1] ?? ''))
const displayValue = computed(() => {
    const fraction = valueParts.value[1]
    return fraction === undefined ? integerText.value : `${integerText.value}.${fraction}`
})
const counterElement = ref<HTMLElement>()
const containerSize = ref({ height: 0, width: 0 })
const sourceWidth = computed(() => 20 + integerDigits.value.length * 130 + fractionDigits.value.length * 78)
const sourceHeight = 270
const effectiveSize = computed(() => {
    if (typeof props.size === 'number') {
        return props.size
    }

    const widthSize = sourceWidth.value > 0 && containerSize.value.width > 0
        ? containerSize.value.width * 160 / sourceWidth.value
        : undefined
    const heightSize = containerSize.value.height > 0
        ? containerSize.value.height * 160 / sourceHeight
        : undefined
    const size = Math.min(...[widthSize, heightSize].filter((value): value is number => value !== undefined))
    return Number.isFinite(size) ? Math.max(1, size) : 16
})
const counterStyle = computed(() => ({
    '--counter-size': `${effectiveSize.value}px`,
}))

function toCounterDigits(value: string) {
    return Array.from(value, (digit) => (isCounterDigit(digit) ? digit : '0'))
}

function isCounterDigit(value: string): value is CounterDigit {
    return value in digitImages
}

function padIntegerPart(value: string) {
    const digits = Math.min(100, Math.max(1, Math.trunc(props.digits)))
    if (value.startsWith('-')) {
        return `-${value.slice(1).padStart(digits, '0')}`
    }
    return value.padStart(digits, '0')
}

let resizeObserver: ResizeObserver | undefined

function updateContainerSize() {
    const element = counterElement.value
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

    const element = counterElement.value
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
</script>

<style scoped>
.counter {
    --counter-size: 16px;
    align-items: flex-end;
    background: #000000;
    border-color: #808080 #ffffff #ffffff #808080;
    border-style: solid;
    border-width: calc(var(--counter-size) * 0.0625);
    box-sizing: border-box;
    display: inline-flex;
    line-height: 0;
    overflow: hidden;
    vertical-align: middle;
}

.counter__digit {
    display: block;
    flex: 0 0 auto;
    height: calc(var(--counter-size) * 1.5625);
    user-select: none;
    width: calc(var(--counter-size) * 0.8125);
}

.counter__fraction {
    align-items: flex-end;
    display: inline-flex;
}

.counter__digit--fraction {
    height: calc(var(--counter-size) * 0.9375);
    width: calc(var(--counter-size) * 0.4875);
}
</style>
