import { createApp, defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { MinesweeperBoard, TouchTrace } from '../../../src'
import type { TouchTraceEvent } from '../../../src'
import { interleavedTouches, makeTouchRecording } from '../../touchTraceEvents'

const events = shallowRef<readonly TouchTraceEvent[]>([])
const endIndex = ref(0)
const size = ref(32)
const shown = ref(true)
const board = Array.from({ length: 16 }, () => Array<number>(30).fill(10))
let app: ReturnType<typeof createApp> | undefined = createApp(defineComponent({ setup: () => () => shown.value ? h(MinesweeperBoard, { board, size: size.value, style: { '--trace-color': '#13579b' } }, {
    // Empty slots trigger the board's default canvas layers; valid placeholders isolate this SVG layer.
    background: () => h('span'), foreground: () => h('span'),
    default: () => h(TouchTrace, { events: events.value, endIndex: endIndex.value, opacity: 0, color: 'var(--trace-color)' }),
}) : null }))
app.mount('#app')

function check(ok: boolean, message: string) { if (!ok) throw new Error(message) }
const svg = () => document.querySelector<SVGSVGElement>('svg')!
const count = (kind: string) => document.querySelectorAll(`[data-touch-${kind}]`).length

async function verify() {
    events.value = interleavedTouches
    endIndex.value = 3
    await nextTick()
    check(count('active') === 2 && count('down') === 2, 'Interleaved contact lifecycle failed.')
    const style = getComputedStyle(svg())
    check(style.pointerEvents === 'none' && style.overflow === 'hidden', 'Input passthrough or clipping is missing.')
    check(getComputedStyle(svg().querySelector('[data-touch-path]')!).stroke === 'rgb(19, 87, 155)', 'CSS variable/currentColor did not resolve.')
    check(svg().querySelector('rect')!.getAttribute('opacity') === '0', 'Transparent mask failed.')
    check(svg().getBoundingClientRect().width === 960 && svg().getBoundingClientRect().height === 512, 'Board extent is incorrect.')
    endIndex.value = 5
    await nextTick()
    check(count('active') === 0 && count('down') === 2, 'Ended contacts or retained history are incorrect.')
    endIndex.value = 6
    await nextTick()
    check(count('active') === 1, 'An active contact was implicitly ended at EOF.')
    endIndex.value = 3
    size.value = 23.5
    await nextTick()
    check(count('active') === 2 && count('down') === 2, 'Rewind did not restore the prefix.')
    check(svg().getBoundingClientRect().width === 705, 'Fractional scaling failed.')
    size.value = 32
    events.value = makeTouchRecording()
    endIndex.value = 0
    await nextTick()
    const started = performance.now()
    for (let end = 1; end <= events.value.length; end++) {
        endIndex.value = end
        await nextTick()
    }
    const sequentialMs = performance.now() - started
    check(count('path') === 500 && count('down') === 500 && count('active') === 0, 'Large recording playback failed.')
    const seekStarted = performance.now()
    for (const end of [3, 8_000, 0, 10_000, 5_555, 40, 10_000]) {
        endIndex.value = end
        await nextTick()
    }
    return { passed: true, events: 10_000, contacts: 500, board: '16x30', cellSize: 32, sequentialMs, seeksMs: performance.now() - seekStarted,
        svgSurfaces: document.querySelectorAll('svg').length, canvases: document.querySelectorAll('canvas').length, devicePixelRatio }
}

async function cycles(rounds: number) {
    for (let round = 0; round < rounds; round++) {
        events.value = []
        shown.value = false
        await nextTick()
        shown.value = true
        events.value = makeTouchRecording()
        endIndex.value = 3
        await nextTick()
        endIndex.value = 10_000
        await nextTick()
        endIndex.value = 400
        await nextTick()
        endIndex.value = 10_000
        await nextTick()
    }
    check(document.querySelectorAll('svg').length === 1 && count('path') === 500 && count('down') === 500, 'Resources accumulate across recording switches.')
    return { rounds, svgSurfaces: 1, contacts: 500 }
}

Object.assign(window, { touchTraceCheck: verify, touchTraceCycles: cycles, disposeTouchTrace: async () => {
    app?.unmount()
    app = undefined
    events.value = []
    await nextTick()
    check(document.querySelectorAll('svg').length === 0, 'Unmount left a drawing surface.')
} })
