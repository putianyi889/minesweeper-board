import type { ComputedRef, InjectionKey } from 'vue'

export type MinesweeperBoardContext = {
  board: ComputedRef<number[][] | undefined>
  size: ComputedRef<number>
}

export const minesweeperBoardKey: InjectionKey<MinesweeperBoardContext> = Symbol('minesweeper-board')
