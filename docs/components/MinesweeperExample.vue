<!-- #region template -->
<template>
  <div class="play-example">
    <div class="play-toolbar">
      <button type="button" @click="reset">New board</button>
      <span>game_board_state: {{ backend?.game_board_state ?? 0 }}</span>
      <span>Hover: {{ hoverCell === undefined ? 'outside' : `${hoverCell.rowIndex + 1}, ${hoverCell.columnIndex + 1}` }}</span>
      <span>mouse_state: {{ backend?.mouse_state ?? 1 }}</span>
    </div>

    <div class="outer-border" style="display: flex; flex-direction: column; font-size: 16px; width: fit-content">
      <div class="inner-border" style="align-self: stretch; display: flex; flex-direction: row">
        <Counter :value="mines-(backend?.flag ?? 0)" :fixed="0" :digits="3" :size="cellSize" />
        <Counter :value="elapsedSeconds" :fixed="3" :digits="3" :size="cellSize" style="margin-left: auto" />
      </div>
      <div class="inner-border">
        <MinesweeperBoard
          ref="boardView"
          :board="displayBoard"
          :size="cellSize"
          @contextmenu.prevent
          @mousedown="handleMouseDown"
          @mouseup="handleMouseUp"
        />
      </div>
    </div>
  </div>
</template>
<!-- #endregion template -->

<!-- #region script -->
<script setup lang="ts">
// #region board-display
import * as ms from 'ms-toollib'
import { computed, onBeforeUnmount, ref, shallowRef, unref, watch } from 'vue'
import type { Ref } from 'vue'
import MinesweeperBoard from '../../src/components/MinesweeperBoard.vue'
import Counter from '../../src/components/Counter.vue'
import '../../src/styles/border.css'

type Board = number[][]
type CellIndex = {
  rowIndex: number
  columnIndex: number
}
type BoardView = {
  cellIndex?: CellIndex | Ref<CellIndex | undefined>
}
type Game = InstanceType<typeof ms.MinesweeperBoard>
type MouseOperation = 'lc' | 'lr' | 'rc' | 'rr'

const rows = 9
const columns = 9
const mines = 10
const cellSize = 24
const MouseState = {
  DownUp: 4,
  Chording: 5,
  ChordingNotFlag: 6,
}
const GameBoardState = {
  Playing: 2,
  Win: 3,
  Loss: 4,
  PreFlagging: 5,
}

const backend = shallowRef<Game>()
const displayBoard = ref<Board>(createHiddenBoard())
const boardView = ref<BoardView>()

const hoverCell = computed<CellIndex | undefined>(() => unref(boardView.value?.cellIndex))

watch(hoverCell, () => {
  const game = backend.value
  if (
    game === undefined ||
    game.game_board_state === GameBoardState.Win ||
    game.game_board_state === GameBoardState.Loss
  ) {
    return
  }
  syncBoard()
})

function createHiddenBoard(): Board {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => 10))
}

function cloneMatrix(matrix: Board): Board {
  return Array.from(matrix, (row) => Array.from(row))
}

function syncBoard(): void {
  const game = backend.value
  if (game === undefined) {
    displayBoard.value = createHiddenBoard()
    return
  }
  const nextBoard = cloneMatrix(game.game_board)
  applyMouseStateHighlight(nextBoard, game, hoverCell.value)
  displayBoard.value = nextBoard
}

function applyMouseStateHighlight(targetBoard: Board, game: Game | undefined, cell: CellIndex | undefined): void {
  if (game === undefined || cell === undefined) {
    return
  }
  if (game.mouse_state === MouseState.DownUp) {
    highlightHiddenCell(targetBoard, cell.rowIndex, cell.columnIndex)
  } else if (
    game.mouse_state === MouseState.Chording ||
    game.mouse_state === MouseState.ChordingNotFlag
  ) {
    highlightArea(targetBoard, cell.rowIndex, cell.columnIndex)
  }
}

function highlightHiddenCell(targetBoard: Board, rowIndex: number, columnIndex: number): void {
  if (targetBoard[rowIndex]?.[columnIndex] === 10 || targetBoard[rowIndex]?.[columnIndex] === 12) {
    targetBoard[rowIndex][columnIndex] = 18
  }
}

function highlightArea(targetBoard: Board, rowIndex: number, columnIndex: number): void {
  for (let row = rowIndex - 1; row <= rowIndex + 1; row += 1) {
    for (let column = columnIndex - 1; column <= columnIndex + 1; column += 1) {
      highlightHiddenCell(targetBoard, row, column)
    }
  }
}
// #endregion board-display

// #region event-handler
function ensureGame(cell: CellIndex): void {
  if (backend.value !== undefined) {
    return
  }
  const generated = ms.laymine_solvable(rows, columns, mines, cell.rowIndex, cell.columnIndex, 8000) as unknown
  const mineBoard = resolveMineBoard(generated)
  backend.value = new ms.MinesweeperBoard(mineBoard)
}

function resolveMineBoard(generated: unknown): Board {
  if (isBoard(generated)) {
    return generated
  }
  if (Array.isArray(generated) && isBoard(generated[0])) {
    return generated[0]
  }
  throw new TypeError('laymine_solvable returned an invalid board')
}

function isBoard(value: unknown): value is Board {
  return Array.isArray(value) &&
    value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'number'))
}

function currentCell(): CellIndex | undefined {
  const cell = hoverCell.value
  if (cell === undefined) {
    return undefined
  }
  return cell
}

function step(operation: MouseOperation, cell: CellIndex): void {
  const game = backend.value
  if (
    game === undefined ||
    game.game_board_state === GameBoardState.Win ||
    game.game_board_state === GameBoardState.Loss
  ) {
    return
  }
  game.step(operation, cell.rowIndex, cell.columnIndex)
  syncBoard()
  syncTimer(game)
}

function handleMouseDown(event: MouseEvent): void {
  const cell = currentCell()
  if (cell === undefined) {
    return
  }
  if (event.button === 0) {
    ensureGame(cell)
    step('lc', cell)
  } else if (event.button === 2 && backend.value !== undefined) {
    event.preventDefault()
    step('rc', cell)
  }
}

function handleMouseUp(event: MouseEvent): void {
  const cell = currentCell()
  if (cell === undefined) {
    return
  }
  if (event.button === 0) {
    step('lr', cell)
  } else if (event.button === 2) {
    event.preventDefault()
    step('rr', cell)
  }
}

function reset(): void {
  resetTimer()
  backend.value = undefined
  displayBoard.value = createHiddenBoard()
}
// #endregion event-handler

// #region timer
const elapsedSeconds = ref<number>(0)

let timerStartedAt: number | undefined
let timerFrame: number | undefined

function startTimer(): void {
  if (timerStartedAt !== undefined) {
    return
  }
  timerStartedAt = performance.now() - elapsedSeconds.value * 1000
  updateTimer()
}

function updateTimer(): void {
  if (timerStartedAt === undefined) {
    return
  }
  elapsedSeconds.value = (performance.now() - timerStartedAt) / 1000
  timerFrame = requestAnimationFrame(updateTimer)
}

function stopTimer(): void {
  if (timerFrame !== undefined) {
    cancelAnimationFrame(timerFrame)
    timerFrame = undefined
  }
  timerStartedAt = undefined
}

function resetTimer(): void {
  stopTimer()
  elapsedSeconds.value = 0
}

function syncTimer(game: Game): void {
  if (game.game_board_state === GameBoardState.Playing) {
    startTimer()
  } else {
    stopTimer()
  }
}

onBeforeUnmount(() => {
  stopTimer()
})
// #endregion timer
</script>
<!-- #endregion script -->

<!-- #region style -->
<style scoped>
.play-example {
  display: inline-flex;
  flex-direction: column;
  gap: 12px;
}

.play-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 14px;
}

.play-toolbar button {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 4px 10px;
}
</style>
<!-- #endregion style -->
