import { shallowMount } from '@vue/test-utils'
import { ImageGrid } from '@putianyi888/vue3-plots'
import { computed, h, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import BoardBackground from '../../src/components/BoardBackground.vue'
import BoardForeground from '../../src/components/BoardForeground.vue'
import BoardProbability from '../../src/components/BoardProbability.vue'
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

    it('renders the default cursor from a cell-unit position', () => {
        const wrapper = shallowMount(MinesweeperBoard, {
            props: {
                board: [
                    [10, 10, 10],
                    [10, 10, 10],
                ],
                cursorPosition: { rowIndex: 1.5, columnIndex: 2 },
                size: 20,
            },
        })
        const cursorLayer = wrapper.find('.minesweeper-board-layer--cursor')

        expect(cursorLayer.exists()).toBe(true)
        expect((cursorLayer.element as HTMLElement).style.getPropertyValue('--minesweeper-cursor-x')).toBe('40px')
        expect((cursorLayer.element as HTMLElement).style.getPropertyValue('--minesweeper-cursor-y')).toBe('30px')
        expect((cursorLayer.element as HTMLElement).style.getPropertyValue('--minesweeper-cursor-size')).toBe('20px')
        expect(wrapper.find('.minesweeper-board-cursor').exists()).toBe(true)
    })

    it('allows a custom cursor slot', () => {
        const wrapper = shallowMount(MinesweeperBoard, {
            props: {
                board: [[10]],
                cursorPosition: { rowIndex: 0.25, columnIndex: 0.75 },
                size: 16,
            },
            slots: {
                cursor: ({ position, size }) => h('span', {
                    'data-column': String(position.columnIndex),
                    'data-row': String(position.rowIndex),
                    'data-size': String(size),
                }),
            },
        })

        expect(wrapper.find('[data-row]').attributes('data-row')).toBe('0.25')
        expect(wrapper.find('[data-column]').attributes('data-column')).toBe('0.75')
        expect(wrapper.find('[data-size]').attributes('data-size')).toBe('16')
        expect(wrapper.find('.minesweeper-board-cursor').exists()).toBe(false)
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

    it('renders probability values as percentage text on canvas', async () => {
        const canvasContext = createCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D)
        const color = vi.fn((value: number) => (value > 0.5 ? '#ff0000' : '#000000'))

        const wrapper = shallowMount(BoardProbability, {
            props: {
                board: [
                    [0, 0.5],
                    [1, 0.125],
                ],
                color,
            },
            global: {
                provide: {
                    [minesweeperBoardKey as symbol]: {
                        board: computed(() => undefined),
                        size: computed(() => 20),
                    },
                },
            },
        })

        await nextTick()

        expect(wrapper.find('canvas').attributes('width')).toBe('40')
        expect(wrapper.find('canvas').attributes('height')).toBe('40')
        expect(canvasContext.fillText).toHaveBeenCalledTimes(4)
        expect(canvasContext.fillText).toHaveBeenNthCalledWith(1, '0', 10, 10)
        expect(canvasContext.fillText).toHaveBeenNthCalledWith(2, '50', 30, 10)
        expect(canvasContext.fillText).toHaveBeenNthCalledWith(3, '100', 10, 30)
        expect(canvasContext.fillText).toHaveBeenNthCalledWith(4, '13', 30, 30)
        expect(canvasContext.fonts).toEqual([
            '10.8px sans-serif',
            '10.8px sans-serif',
            '8.4px sans-serif',
            '10.8px sans-serif',
        ])
        expect(color).toHaveBeenCalledWith(1, 1, 0)

        getContext.mockRestore()
    })

    it('redraws only changed probability cells when the board changes', async () => {
        const canvasContext = createCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D)
        const wrapper = shallowMount(BoardProbability, {
            props: {
                board: [[0, 0.5]],
            },
            global: {
                provide: {
                    [minesweeperBoardKey as symbol]: {
                        board: computed(() => undefined),
                        size: computed(() => 16),
                    },
                },
            },
        })

        await nextTick()
        canvasContext.clearRect.mockClear()
        canvasContext.fillText.mockClear()

        await wrapper.setProps({ board: [[0, 0.75]] })

        expect(canvasContext.fillText).toHaveBeenCalledTimes(1)
        expect(canvasContext.clearRect).toHaveBeenCalledTimes(1)
        expect(canvasContext.clearRect).toHaveBeenCalledWith(16, 0, 16, 16)
        expect(canvasContext.fillText).toHaveBeenCalledWith('75', 24, 8)

        canvasContext.clearRect.mockClear()
        canvasContext.fillText.mockClear()
        await wrapper.setProps({ board: [[0, 0.75]] })

        expect(canvasContext.clearRect).not.toHaveBeenCalled()
        expect(canvasContext.fillText).not.toHaveBeenCalled()

        getContext.mockRestore()
    })

    it('hides probability values on opened cells and cells with foreground content', async () => {
        const canvasContext = createCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D)

        shallowMount(BoardProbability, {
            props: {
                board: [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]],
            },
            global: {
                provide: {
                    [minesweeperBoardKey as symbol]: {
                        board: computed(() => [[10, 0, 11, 12, 16, 5, 18]]),
                        size: computed(() => 10),
                    },
                },
            },
        })

        await nextTick()

        expect(canvasContext.fillText).toHaveBeenCalledTimes(3)
        expect(canvasContext.fillText).toHaveBeenNthCalledWith(1, '10', 5, 5)
        expect(canvasContext.fillText).toHaveBeenNthCalledWith(2, '40', 35, 5)
        expect(canvasContext.fillText).toHaveBeenNthCalledWith(3, '70', 65, 5)

        getContext.mockRestore()
    })

    it('redraws only cells whose source board visibility changed', async () => {
        const canvasContext = createCanvasContext()
        const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D)
        const sourceBoard = ref([[10, 10]])

        shallowMount(BoardProbability, {
            props: {
                board: [[0.25, 0.75]],
            },
            global: {
                provide: {
                    [minesweeperBoardKey as symbol]: {
                        board: computed(() => sourceBoard.value),
                        size: computed(() => 16),
                    },
                },
            },
        })

        await nextTick()
        canvasContext.clearRect.mockClear()
        canvasContext.fillText.mockClear()

        sourceBoard.value = [[0, 10]]
        await nextTick()

        expect(canvasContext.clearRect).toHaveBeenCalledTimes(1)
        expect(canvasContext.clearRect).toHaveBeenCalledWith(0, 0, 16, 16)
        expect(canvasContext.fillText).not.toHaveBeenCalled()

        getContext.mockRestore()
    })
})

function createCanvasContext() {
    const fonts: string[] = []
    return {
        clearRect: vi.fn(),
        fillText: vi.fn(),
        fillStyle: '',
        fonts,
        get font() {
            return fonts.at(-1) ?? ''
        },
        set font(value: string) {
            fonts.push(value)
        },
        textAlign: '',
        textBaseline: '',
    }
}
