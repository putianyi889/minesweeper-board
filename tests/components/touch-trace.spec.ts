import { mount } from '@vue/test-utils'
import { computed, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import TouchTrace from '../../src/components/TouchTrace.vue'
import MinesweeperBoard from '../../src/components/MinesweeperBoard.vue'
import { minesweeperBoardKey } from '../../src/components/context'
import type { TouchTraceEvent } from '../../src/components/touchTrace'
import { interleavedTouches, makeTouchRecording } from '../touchTraceEvents'

function mountTrace(extra = {}) {
    const size = ref(32)
    const board = ref(Array.from({ length: 3 }, () => [10, 10, 10]))
    const wrapper = mount(TouchTrace, {
        props: { events: interleavedTouches, ...extra },
        global: { provide: { [minesweeperBoardKey as symbol]: { board: computed(() => board.value), size: computed(() => size.value) } } },
    })
    return { wrapper, size, board }
}
const ids = (wrapper: ReturnType<typeof mountTrace>['wrapper'], kind: string) => wrapper.findAll(`[data-touch-${kind}]`).map((element) => Number(element.attributes(`data-touch-${kind}`)))

describe('TouchTrace Vue layer', () => {
    it('renders prefixes, simultaneous active contacts, persistent down markers and rewind', async () => {
        const { wrapper } = mountTrace({ endIndex: 0, opacity: 0 })
        expect(ids(wrapper, 'path')).toEqual([])
        await wrapper.setProps({ endIndex: 3 })
        expect(ids(wrapper, 'active')).toEqual([10, 20])
        expect(ids(wrapper, 'down')).toEqual([10, 20])
        expect(wrapper.get('[data-touch-path="10"]').attributes('d')).toBe('M 0.5 0.5 L 2.5 0.5')
        expect(wrapper.get('rect').attributes('opacity')).toBe('0')
        await wrapper.setProps({ endIndex: 4 })
        expect(ids(wrapper, 'active')).toEqual([10])
        await wrapper.setProps({ endIndex: 5 })
        expect(ids(wrapper, 'active')).toEqual([])
        expect(ids(wrapper, 'down')).toHaveLength(2)
        await wrapper.setProps({ endIndex: 6 })
        expect(ids(wrapper, 'active')).toEqual([30])
        await wrapper.setProps({ endIndex: 3 })
        expect(ids(wrapper, 'active')).toEqual([10, 20])
        expect(wrapper.find('[data-touch-path="30"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('supports reactive in-place edits, push, splice, and array replacement without stale geometry', async () => {
        const events = ref<TouchTraceEvent[]>(interleavedTouches.map((event) => ({ ...event })))
        const { wrapper } = mountTrace({ events: events.value, endIndex: 3 })
        events.value[2]!.column = 9
        await nextTick()
        expect(wrapper.get('[data-touch-path="10"]').attributes('d')).toBe('M 0.5 0.5 L 9 0.5')
        await wrapper.setProps({ endIndex: undefined })
        events.value.push({ id: 30, row: 8, column: 9, action: 'move' })
        await nextTick()
        expect(wrapper.get('[data-touch-active="30"]').attributes('transform')).toBe('translate(9 8)')
        events.value.splice(0)
        await nextTick()
        expect(ids(wrapper, 'path')).toEqual([])
        expect(ids(wrapper, 'active')).toEqual([])
        await wrapper.setProps({ events: interleavedTouches })
        expect(ids(wrapper, 'path')).toHaveLength(3)
        await wrapper.setProps({ events: [] })
        expect(ids(wrapper, 'down')).toEqual([])
        wrapper.unmount()
    })

    it('scales and clips without clamping source coordinates, and updates styles independently', async () => {
        const { wrapper, size, board } = mountTrace({ endIndex: 3, color: 'var(--trace-color)' })
        expect(wrapper.attributes('width')).toBe('96')
        expect(wrapper.attributes('viewBox')).toBe('0 0 3 3')
        expect(wrapper.attributes('style')).toContain('var(--trace-color)')
        expect(wrapper.get('[data-touch-down="10"] circle').attributes('r')).toBe('0.125')
        expect(wrapper.get('[data-touch-down="10"]').attributes('opacity')).toBe('0.6')
        size.value = 23.5
        board.value = [[10, 10]]
        await nextTick()
        expect(wrapper.attributes('width')).toBe('47')
        expect(wrapper.attributes('height')).toBe('23.5')
        expect(wrapper.attributes('viewBox')).toBe('0 0 2 1')
        expect(wrapper.get('[data-touch-path="10"]').attributes('d')).toContain('2.5 0.5')
        await wrapper.setProps({ lineWidth: 0.2, downMarker: false, activeMarker: { shape: 'diamond', size: 0.5, fill: 'var(--active-color)', stroke: 'red', strokeWidth: 0.05, opacity: 0.8 } })
        expect(ids(wrapper, 'down')).toEqual([])
        expect(wrapper.get('g[stroke="currentColor"]').attributes('stroke-width')).toBe('0.2')
        const active = wrapper.get('[data-touch-active="10"]')
        expect(active.attributes()).toMatchObject({ fill: 'var(--active-color)', stroke: 'red', 'stroke-width': '0.05', opacity: '0.8' })
        expect(active.get('path').attributes('d')).toContain('0.25')
        await wrapper.setProps({ activeMarker: false })
        expect(ids(wrapper, 'active')).toEqual([])
        wrapper.unmount()
    })

    it.each(['circle', 'ring', 'cross', 'square', 'diamond'] as const)('uses the shared marker fields for %s', (shape) => {
        const { wrapper } = mountTrace({ endIndex: 1, downMarker: { shape, size: 0.25, stroke: 'blue' } })
        const marker = wrapper.get('[data-touch-down="10"]')
        expect(marker.find(shape === 'circle' || shape === 'ring' ? 'circle' : 'path').exists()).toBe(true)
        if (shape === 'ring' || shape === 'cross') expect(marker.attributes('fill')).toBe('none')
        wrapper.unmount()
    })

    it('does not scan reactive event history when only endIndex changes', async () => {
        let reads = 0
        const source = makeTouchRecording()
        const observed = source.map((event) => ({ ...event, get row() { reads++; return event.row } }))
        const { wrapper } = mountTrace({ events: observed, endIndex: 0 })
        reads = 0
        await wrapper.setProps({ endIndex: 1 })
        expect(reads).toBeLessThan(10)
        wrapper.unmount()
    })

    it('works inside the actual board slot, infers optional board bounds, and releases its SVG on unmount', async () => {
        const wrapper = mount(MinesweeperBoard, { props: { size: 24 }, slots: { default: () => h(TouchTrace, { events: interleavedTouches }) } })
        const svg = wrapper.get('svg')
        expect(svg.attributes('viewBox')).toBe('0 0 3 3')
        expect(svg.attributes('width')).toBe('72')
        expect(wrapper.findAll('svg')).toHaveLength(1)
        expect(wrapper.findAll('canvas')).toHaveLength(0)
        const container = wrapper.element.parentElement!
        wrapper.unmount()
        expect(container.querySelector('svg')).toBeNull()
    })
})
