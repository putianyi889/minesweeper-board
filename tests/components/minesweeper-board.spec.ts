import { shallowMount } from '@vue/test-utils'
import { ImageGrid } from '@putianyi888/vue3-plots'
import { computed, h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import BoardBackground from '../../src/components/BoardBackground.vue'
import BoardForeground from '../../src/components/BoardForeground.vue'
import Counter from '../../src/components/Counter.vue'
import MinesweeperBoard from '../../src/components/MinesweeperBoard.vue'
import { minesweeperBoardKey } from '../../src/components/context'

describe('MinesweeperBoard', () => {
    it('renders background and foreground layers by default', () => {
        const wrapper = shallowMount(MinesweeperBoard, {
            props: {
                board: [[10]],
                size: 24,
            },
        })

        expect(wrapper.classes()).toContain('minesweeper-board-content')
        expect(wrapper.find('.outer-border').exists()).toBe(false)
        expect(wrapper.find('.inner-border').exists()).toBe(false)
        expect(wrapper.findComponent(BoardBackground).exists()).toBe(true)
        expect(wrapper.findComponent(BoardForeground).exists()).toBe(true)
    })

    it('renders background default foreground layers without an internal border', () => {
        const wrapper = shallowMount(MinesweeperBoard, {
            props: {
                board: [[10]],
                size: 24,
            },
            slots: {
                background: '<div data-layer="background" />',
                border: '<div data-layer="border" />',
                default: '<div data-layer="default" />',
                foreground: '<div data-layer="foreground" />',
            },
        })

        const layers = wrapper.findAll('.minesweeper-board-layer').map((layer) => {
            return layer.find('[data-layer]').attributes('data-layer')
        })

        expect(layers).toEqual(['background', 'default', 'foreground'])
        expect(wrapper.find('[data-layer="border"]').exists()).toBe(false)
    })

    it('fits auto size to the parent container', async () => {
        const observe = vi.fn()
        const disconnect = vi.fn()

        class MockResizeObserver implements ResizeObserver {
            private readonly callback: ResizeObserverCallback

            constructor(callback: ResizeObserverCallback) {
                this.callback = callback
            }

            observe(target: Element) {
                observe(target)
                this.callback([
                    {
                        contentRect: { height: 105, width: 210 },
                    } as ResizeObserverEntry,
                ], this)
            }

            unobserve = vi.fn()

            disconnect() {
                disconnect()
            }
        }

        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const wrapper = shallowMount(MinesweeperBoard, {
            props: {
                board: [
                    [10, 10],
                    [10, 10],
                ],
                size: 'auto',
            },
            slots: {
                default: ({ size }) => h('span', { 'data-size': String(size) }),
            },
        })

        await nextTick()

        expect(observe).toHaveBeenCalled()
        expect(wrapper.find('[data-size]').attributes('data-size')).toBe('52.5')

        wrapper.unmount()
        expect(disconnect).toHaveBeenCalled()
        vi.unstubAllGlobals()
    })

    it('exposes the current mouse cell index', async () => {
        const wrapper = shallowMount(MinesweeperBoard, {
            props: {
                board: [
                    [10, 10],
                    [10, 10],
                ],
                size: 24,
            },
        })
        const content = wrapper.find('.minesweeper-board-content').element as HTMLElement
        vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({
            bottom: 66,
            height: 48,
            left: 18,
            right: 66,
            top: 18,
            width: 48,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        })

        await wrapper.trigger('mousemove', { clientX: 48, clientY: 28 })
        expect(wrapper.vm.cellIndex).toEqual({ rowIndex: 0, columnIndex: 1 })

        await wrapper.trigger('mouseleave')
        expect(wrapper.vm.cellIndex).toBeUndefined()
    })

    it('keeps the same cell index reference while moving inside one cell', async () => {
        const wrapper = shallowMount(MinesweeperBoard, {
            props: {
                board: [
                    [10, 10],
                    [10, 10],
                ],
                size: 24,
            },
        })
        const content = wrapper.find('.minesweeper-board-content').element as HTMLElement
        vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({
            bottom: 48,
            height: 48,
            left: 0,
            right: 48,
            top: 0,
            width: 48,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        })

        await wrapper.trigger('mousemove', { clientX: 4, clientY: 4 })
        const firstCellIndex = wrapper.vm.cellIndex

        await wrapper.trigger('mousemove', { clientX: 20, clientY: 20 })
        expect(wrapper.vm.cellIndex).toBe(firstCellIndex)

        await wrapper.trigger('mousemove', { clientX: 28, clientY: 20 })
        expect(wrapper.vm.cellIndex).toEqual({ rowIndex: 0, columnIndex: 1 })
        expect(wrapper.vm.cellIndex).not.toBe(firstCellIndex)
    })

    it('renders board content without exported border classes', () => {
        const wrapper = shallowMount(MinesweeperBoard, {
            props: {
                board: [
                    [10, 10, 10],
                    [10, 10, 10],
                ],
                size: 16,
            },
        })

        expect(wrapper.classes()).toContain('minesweeper-board-content')
        expect(wrapper.find('.outer-border').exists()).toBe(false)
        expect(wrapper.find('.inner-border').exists()).toBe(false)
        expect((wrapper.element as HTMLElement).style.length).toBe(0)
    })

    it('renders counter digits from svg assets', () => {
        const wrapper = shallowMount(Counter, {
            props: {
                value: -12.34,
                fixed: 2,
                digits: 4,
                size: 16,
            },
        })
        const digits = wrapper.findAll('img')

        expect(wrapper.attributes('aria-label')).toBe('-0012.34')
        expect(digits).toHaveLength(7)
        expect(digits.map((digit) => digit.attributes('data-counter-digit'))).toEqual([
            '-',
            '0',
            '0',
            '1',
            '2',
            '3',
            '4',
        ])
        expect(digits.every((digit) => digit.attributes('src')?.startsWith('data:image/svg+xml'))).toBe(true)
        expect((wrapper.element as HTMLElement).style.getPropertyValue('--counter-size')).toBe('16px')
        expect(digits[6]?.classes()).toContain('counter__digit--fraction')
    })

    it('fits counter auto size to the parent container', async () => {
        const observe = vi.fn()
        const disconnect = vi.fn()

        class MockResizeObserver implements ResizeObserver {
            private readonly callback: ResizeObserverCallback

            constructor(callback: ResizeObserverCallback) {
                this.callback = callback
            }

            observe(target: Element) {
                observe(target)
                this.callback([
                    {
                        contentRect: { height: 135, width: 280 },
                    } as ResizeObserverEntry,
                ], this)
            }

            unobserve = vi.fn()

            disconnect() {
                disconnect()
            }
        }

        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const wrapper = shallowMount(Counter, {
            props: {
                value: 88,
                digits: 2,
                size: 'auto',
            },
        })

        await nextTick()

        expect(observe).toHaveBeenCalled()
        expect((wrapper.element as HTMLElement).style.getPropertyValue('--counter-size')).toBe('80px')

        wrapper.unmount()
        expect(disconnect).toHaveBeenCalled()
        vi.unstubAllGlobals()
    })

    it('allows counter class and style attrs', () => {
        const wrapper = shallowMount(Counter, {
            attrs: {
                class: 'custom-counter',
                style: 'color: red;',
            },
            props: {
                value: 8,
                size: 16,
            },
        })

        expect(wrapper.classes()).toContain('counter')
        expect(wrapper.classes()).toContain('custom-counter')
        expect((wrapper.element as HTMLElement).style.color).toBe('red')
        expect((wrapper.element as HTMLElement).style.getPropertyValue('--counter-size')).toBe('16px')
    })

    it('maps boolean background values to up and down cells', () => {
        const wrapper = shallowMount(BoardBackground, {
            props: {
                board: [
                    [true, false],
                    [false, true],
                ],
            },
            global: {
                provide: {
                    [minesweeperBoardKey as symbol]: {
                        board: computed(() => undefined),
                        size: computed(() => 24),
                    },
                },
            },
        })
        const imageGrid = wrapper.findComponent(ImageGrid)

        expect(imageGrid.props('cellWidth')).toBe(24)
        expect(imageGrid.props('cellHeight')).toBe(24)
        expect(imageGrid.props('cells')).toEqual([
            ['down', 'up'],
            ['up', 'down'],
        ])
    })

    it('maps ms_toollib values from context to background cells', () => {
        const wrapper = shallowMount(BoardBackground, {
            global: {
                provide: {
                    [minesweeperBoardKey as symbol]: {
                        board: computed(() => [
                            [0, 1, 8, 14, 15, 18],
                            [10, 11, 12, 16, 99],
                        ]),
                        size: computed(() => 24),
                    },
                },
            },
        })
        const imageGrid = wrapper.findComponent(ImageGrid)

        expect(imageGrid.props('cells')).toEqual([
            ['down', 'down', 'down', 'down', 'down', 'down'],
            ['up', 'up', 'up', 'up', 'up'],
        ])
    })

    it('maps ms_toollib values from context to foreground cells', () => {
        const wrapper = shallowMount(BoardForeground, {
            global: {
                provide: {
                    [minesweeperBoardKey as symbol]: {
                        board: computed(() => [
                            [0, 1, 2, 3, 4, 5],
                            [6, 7, 8, 10, 11, 12],
                            [14, 15, 16, 18, 99],
                        ]),
                        size: computed(() => 24),
                    },
                },
            },
        })
        const imageGrid = wrapper.findComponent(ImageGrid)

        expect(imageGrid.props('cellWidth')).toBe(24)
        expect(imageGrid.props('cellHeight')).toBe(24)
        expect(imageGrid.props('cells')).toEqual([
            ['blank', 'num1', 'num2', 'num3', 'num4', 'num5'],
            ['num6', 'num7', 'num8', 'blank', 'flag', 'blank'],
            ['falsemine', 'blast', 'mine', 'blank', 'blank'],
        ])
    })
})
