import celldown from '../assets/celldown.svg?url'
import cellup from '../assets/cellup.svg?url'
import blast from '../assets/blast.svg?url'
import falsemine from '../assets/falsemine.svg?url'
import flag from '../assets/flag.svg?url'
import mine from '../assets/mine.svg?url'
import blank from '../assets/null.svg?url'
import num1 from '../assets/num1.svg?url'
import num2 from '../assets/num2.svg?url'
import num3 from '../assets/num3.svg?url'
import num4 from '../assets/num4.svg?url'
import num5 from '../assets/num5.svg?url'
import num6 from '../assets/num6.svg?url'
import num7 from '../assets/num7.svg?url'
import num8 from '../assets/num8.svg?url'

export const backgroundImages = { down: celldown, up: cellup }
export const foregroundImages = { blank, num1, num2, num3, num4, num5, num6, num7, num8, mine, flag, falsemine, blast }
const downValues = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 18])
const foregroundValueByBoardValue: Record<number, number> = {
    0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8,
    10: 0, 11: -2, 12: 0, 14: -3, 15: -4, 16: -1, 18: 0,
}
const cellKeyByValue: Record<number, keyof typeof foregroundImages> = {
    0: 'blank', 1: 'num1', 2: 'num2', 3: 'num3', 4: 'num4', 5: 'num5',
    6: 'num6', 7: 'num7', 8: 'num8',
    [-1]: 'mine', [-2]: 'flag', [-3]: 'falsemine', [-4]: 'blast',
}

export function getBackgroundBoard(board: readonly (readonly number[])[]) {
    return board.map((row) => row.map((cell) => downValues.has(cell)))
}

export function getForegroundBoard(board: readonly (readonly number[])[]) {
    return board.map((row) => row.map((cell) => foregroundValueByBoardValue[cell] ?? 0))
}

export function getForegroundKey(value: number) {
    return cellKeyByValue[value] ?? 'blank'
}
