<template>
    <ImageGrid
        :cell-height="context.size.value"
        :cell-width="context.size.value"
        :cells="cells"
        :images="images"
    />
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { PropType } from 'vue'
import { ImageGrid } from '@putianyi888/vue3-plots'
import blast from '../assets/blast.svg?url'
import falsemine from '../assets/falsemine.svg?url'
import flag from '../assets/flag.svg?url'
import mine from '../assets/mine.svg?url'
import nullImage from '../assets/null.svg?url'
import num1 from '../assets/num1.svg?url'
import num2 from '../assets/num2.svg?url'
import num3 from '../assets/num3.svg?url'
import num4 from '../assets/num4.svg?url'
import num5 from '../assets/num5.svg?url'
import num6 from '../assets/num6.svg?url'
import num7 from '../assets/num7.svg?url'
import num8 from '../assets/num8.svg?url'
import { minesweeperBoardKey } from './context'

const props = defineProps({
    /** Foreground matrix. Uses 0 for blank, 1-8 for numbers, and negative values for mine states. */
    board: { type: Array as PropType<number[][]>, default: undefined },
})

const context = inject(minesweeperBoardKey)
if (context === undefined) {
    throw new Error('BoardForeground must be used inside MinesweeperBoard.')
}

const images = {
    blank: nullImage,
    num1,
    num2,
    num3,
    num4,
    num5,
    num6,
    num7,
    num8,
    mine,
    flag,
    falsemine,
    blast,
}
const foregroundValueByBoardValue: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    10: 0,
    11: -2,
    12: 0,
    14: -3,
    15: -4,
    16: -1,
    18: 0,
}
const cellKeyByValue: Record<number, keyof typeof images> = {
    0: 'blank',
    1: 'num1',
    2: 'num2',
    3: 'num3',
    4: 'num4',
    5: 'num5',
    6: 'num6',
    7: 'num7',
    8: 'num8',
    [-1]: 'mine',
    [-2]: 'flag',
    [-3]: 'falsemine',
    [-4]: 'blast',
}
const foregroundBoard = computed(() => {
    if (props.board !== undefined) {
        return props.board
    }
    const source = context.board.value
    if (source === undefined) {
        throw new Error('BoardForeground requires a board prop or MinesweeperBoard board context.')
    }
    return source.map((row) => row.map((cell) => foregroundValueByBoardValue[cell] ?? 0))
})
const cells = computed(() => foregroundBoard.value.map((row) => row.map((cell) => cellKeyByValue[cell] ?? 'blank')))
</script>
