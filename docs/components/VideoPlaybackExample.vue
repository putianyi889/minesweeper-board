<!-- #region template -->
<template>
  <div class="video-example">
    <div class="video-toolbar">
      <label class="file-button">
        <input type="file" accept=".avf,.evf,.mvf,.rmv" @change="handleFileChange">
        Open video
      </label>
      <button type="button" :disabled="video === undefined" @click="togglePlayback">
        {{ isPlaying ? 'Pause' : 'Play' }}
      </button>
      <button type="button" :disabled="video === undefined" @click="stopPlayback">
        Stop
      </button>
      <label class="trace-toggle">
        <input v-model="showTrace" type="checkbox">
        Mouse trace
      </label>
      <span>{{ fileName }}</span>
      <span>{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
    </div>

    <input
      v-model.number="currentTime"
      class="time-slider"
      type="range"
      min="0"
      :max="duration"
      step="0.01"
      :disabled="video === undefined"
      @input="syncPlaybackFrame"
    >

    <div class="outer-border" style="font-size: 16px; width: fit-content">
      <div class="inner-border">
        <MinesweeperBoard
          :board="displayBoard"
          :cursor-position="cursorPosition"
          :size="cellSize"
        >
          <MouseTrace
            v-if="showTrace"
            :color="traceColor"
            :events="traceEvents"
            :end-index="traceEndIndex"
            :line-width="traceLineWidth"
            :markers="markerProps"
            :opacity="traceOpacity"
          />
        </MinesweeperBoard>
      </div>
    </div>

    <details class="appearance-panel" open>
      <summary>Trace appearance</summary>
      <div class="appearance-grid">
        <label>
          Background
          <input v-model.number="traceOpacity" class="range-control" type="range" min="0" max="1" step="0.01">
          <span>{{ traceOpacity.toFixed(2) }}</span>
        </label>
        <label>
          Line width
          <input v-model.number="traceLineWidth" class="range-control" type="range" min="0.02" max="0.3" step="0.01">
          <span>{{ traceLineWidth.toFixed(2) }}</span>
        </label>
        <label v-for="state in traceStates" :key="state">
          {{ state }}
          <input v-model="traceColor[state]" type="color">
        </label>
      </div>
    </details>

    <details class="appearance-panel">
      <summary>Marker appearance</summary>
      <div class="marker-grid">
        <fieldset v-for="action in markerActions" :key="action" class="marker-fieldset">
          <legend>{{ action }}</legend>
          <label>
            Shape
            <select v-model="markerConfig[action].shape">
              <option v-for="shape in markerShapes" :key="shape" :value="shape">
                {{ shape }}
              </option>
            </select>
          </label>
          <label>
            Fill
            <input v-model="markerConfig[action].fill" type="color">
          </label>
          <label>
            Stroke
            <input v-model="markerConfig[action].stroke" type="color">
          </label>
          <label>
            Size
            <input v-model.number="markerConfig[action].size" type="range" min="0.1" max="1" step="0.01">
            <span>{{ markerConfig[action].size.toFixed(2) }}</span>
          </label>
          <label>
            Stroke width
            <input v-model.number="markerConfig[action].strokeWidth" type="range" min="0.02" max="0.3" step="0.01">
            <span>{{ markerConfig[action].strokeWidth.toFixed(2) }}</span>
          </label>
          <label>
            Opacity
            <input v-model.number="markerConfig[action].opacity" type="range" min="0" max="1" step="0.01">
            <span>{{ markerConfig[action].opacity.toFixed(2) }}</span>
          </label>
        </fieldset>
      </div>
    </details>

    <p v-if="message !== ''" class="video-message">{{ message }}</p>
  </div>
</template>
<!-- #endregion template -->

<!-- #region script -->
<script setup lang="ts">
import * as ms from 'ms-toollib'
import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import MinesweeperBoard, {
  defaultMouseTraceColor,
  MouseTrace,
  mouseTraceMarkerActions,
  mouseTraceMarkerShapes,
  mouseTraceStates,
} from '@putianyi888/vue3-minesweeper-board'
import type {
  MouseTraceAction,
  MouseTraceEvent,
  MouseTraceMarkerAction,
  MouseTraceResolvedMarker,
  MouseTraceState,
} from '@putianyi888/vue3-minesweeper-board'
import '@putianyi888/vue3-minesweeper-board/style.css'

type Board = number[][]
type Video = InstanceType<typeof ms.AvfVideo> |
  InstanceType<typeof ms.EvfVideo> |
  InstanceType<typeof ms.MvfVideo> |
  InstanceType<typeof ms.RmvVideo>
type CursorPosition = {
  rowIndex: number
  columnIndex: number
}
type TimedTraceEvent = MouseTraceEvent & {
  time: number
}
type MousePayload = {
  mouse: string
  x: number
  y: number
}
type MouseRecord = {
  event: {
    is_mouse: () => boolean
    unwrap_mouse: () => MousePayload
  }
  mouse_state: number
  time: number
}

const cellSize = 16
const MouseState = {
  UpUp: 1,
  UpDown: 2,
  UpDownNotFlag: 3,
  DownUp: 4,
  Chording: 5,
  ChordingNotFlag: 6,
  DownUpAfterChording: 7,
  Undefined: 8,
} as const
const traceStates = mouseTraceStates
const markerActions = mouseTraceMarkerActions
const markerShapes = mouseTraceMarkerShapes

const video = shallowRef<Video>()
const displayBoard = ref<Board>(createHiddenBoard(0, 0))
const cursorPosition = ref<CursorPosition>()
const currentTime = ref(0)
const duration = ref(0)
const fileName = ref('No file selected')
const isPlaying = ref(false)
const showTrace = ref(true)
const timedTraceEvents = ref<TimedTraceEvent[]>([])
const message = ref('')
const traceOpacity = ref(0.12)
const traceLineWidth = ref(0.08)
const traceColor = reactive<Record<MouseTraceState, string>>({ ...defaultMouseTraceColor })
const markerConfig = reactive<Record<MouseTraceMarkerAction, MouseTraceResolvedMarker>>({
  lc: {
    fill: '#ffdf00',
    opacity: 1,
    shape: 'circle',
    size: 0.5,
    stroke: '#ffffff',
    strokeWidth: 0.08,
  },
  lr: {
    fill: '#000000',
    opacity: 1,
    shape: 'ring',
    size: 0.58,
    stroke: '#ffdf00',
    strokeWidth: 0.08,
  },
  rc: {
    fill: '#38d9ff',
    opacity: 1,
    shape: 'diamond',
    size: 0.5,
    stroke: '#ffffff',
    strokeWidth: 0.08,
  },
  rr: {
    fill: '#000000',
    opacity: 1,
    shape: 'cross',
    size: 0.5,
    stroke: '#38d9ff',
    strokeWidth: 0.1,
  },
})

let animationFrame: number | undefined
let playbackStartedAt: number | undefined
let playbackStartedFrom = 0

const traceEvents = computed<MouseTraceEvent[]>(() => timedTraceEvents.value.map((event) => ({
  action: event.action,
  column: event.column,
  row: event.row,
  state: event.state,
})))
const traceEndIndex = computed(() => findTraceEndIndex(timedTraceEvents.value, currentTime.value))
const markerProps = computed(() => Object.fromEntries(markerActions.map((action) => [
  action,
  {
    ...markerConfig[action],
    fill: markerConfig[action].shape === 'ring' || markerConfig[action].shape === 'cross'
      ? 'transparent'
      : markerConfig[action].fill,
  },
])))

watch(currentTime, () => {
  if (!isPlaying.value) {
    syncPlaybackFrame()
  }
})

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file === undefined) {
    return
  }

  stopPlayback()
  fileName.value = file.name
  message.value = ''

  try {
    const data = new Uint8Array(await file.arrayBuffer())
    const nextVideo = createVideo(data, file.name)
    nextVideo.parse()
    nextVideo.analyse()
    video.value?.free()
    video.value = nextVideo
    duration.value = getVideoDuration(nextVideo)
    currentTime.value = 0
    timedTraceEvents.value = createTraceEvents(nextVideo)
    displayBoard.value = createHiddenBoard(nextVideo.row, nextVideo.column)
    syncPlaybackFrame()
  } catch (error) {
    resetVideo()
    message.value = error instanceof Error ? error.message : 'Failed to load video.'
  } finally {
    input.value = ''
  }
}

function createVideo(data: Uint8Array, name: string): Video {
  const extension = name.split('.').pop()?.toLowerCase()
  if (extension === 'avf') {
    return new ms.AvfVideo(data, name)
  }
  if (extension === 'evf') {
    return new ms.EvfVideo(data, name)
  }
  if (extension === 'mvf') {
    return new ms.MvfVideo(data, name)
  }
  if (extension === 'rmv') {
    return new ms.RmvVideo(data, name)
  }
  throw new Error('Unsupported video format.')
}

function createTraceEvents(sourceVideo: Video): TimedTraceEvent[] {
  const pixSize = sourceVideo.pix_size || cellSize

  return (sourceVideo.events as unknown[])
    .map((record) => readMouseRecord(record))
    .filter((event): event is { mouseState: number; payload: MousePayload; time: number } => event !== undefined)
    .map(({ mouseState, payload, time }) => {
      const action = normalizeTraceAction(payload.mouse)
      if (action === undefined) {
        return undefined
      }
      return {
        action,
        column: payload.x / pixSize,
        row: payload.y / pixSize,
        state: getTraceState(mouseState),
        time,
      }
    })
    .filter((event): event is TimedTraceEvent => event !== undefined)
}

function readMouseRecord(record: unknown): { mouseState: number; payload: MousePayload; time: number } | undefined {
  if (!isVideoRecord(record) || !record.event.is_mouse()) {
    return undefined
  }
  const payload = record.event.unwrap_mouse()
  return {
    payload: {
      mouse: payload.mouse,
      x: payload.x,
      y: payload.y,
    },
    mouseState: record.mouse_state,
    time: record.time,
  }
}

function normalizeTraceAction(action: string): MouseTraceAction | undefined {
  if (action === 'mv' || action === 'lc' || action === 'lr' || action === 'rc' || action === 'rr') {
    return action
  }
  return undefined
}

function getTraceState(mouseState: number): MouseTraceState {
  if (
    mouseState === MouseState.Chording ||
    mouseState === MouseState.ChordingNotFlag
  ) {
    return 'dd'
  }
  if (
    mouseState === MouseState.DownUp ||
    mouseState === MouseState.DownUpAfterChording
  ) {
    return 'du'
  }
  if (
    mouseState === MouseState.UpDown ||
    mouseState === MouseState.UpDownNotFlag
  ) {
    return 'ud'
  }
  return 'uu'
}

function togglePlayback(): void {
  if (video.value === undefined) {
    return
  }
  if (isPlaying.value) {
    pausePlayback()
  } else {
    play()
  }
}

function play(): void {
  if (video.value === undefined) {
    return
  }
  if (currentTime.value >= duration.value) {
    currentTime.value = 0
  }
  isPlaying.value = true
  playbackStartedFrom = currentTime.value
  playbackStartedAt = performance.now()
  animationFrame = requestAnimationFrame(updatePlayback)
}

function pausePlayback(): void {
  isPlaying.value = false
  clearAnimationFrame()
}

function stopPlayback(): void {
  pausePlayback()
  currentTime.value = 0
  syncPlaybackFrame()
}

function updatePlayback(): void {
  if (!isPlaying.value || playbackStartedAt === undefined) {
    return
  }

  currentTime.value = Math.min(duration.value, playbackStartedFrom + (performance.now() - playbackStartedAt) / 1000)
  syncPlaybackFrame()
  if (currentTime.value >= duration.value) {
    pausePlayback()
    return
  }
  animationFrame = requestAnimationFrame(updatePlayback)
}

function syncPlaybackFrame(): void {
  const sourceVideo = video.value
  if (sourceVideo === undefined) {
    return
  }

  sourceVideo.current_time = currentTime.value
  syncCursor(sourceVideo)
  syncGameBoard(sourceVideo)
}

function syncCursor(sourceVideo: Video): void {
  const pixSize = sourceVideo.pix_size || cellSize
  const position = sourceVideo.x_y
  cursorPosition.value = {
    columnIndex: position.x / pixSize,
    rowIndex: position.y / pixSize,
  }
}

function syncGameBoard(sourceVideo: Video): void {
  try {
    const board = sourceVideo.game_board as unknown
    if (isBoard(board)) {
      displayBoard.value = board.map((row) => [...row])
      return
    }
  } catch {
    message.value = 'Failed to read board state from this file.'
  }
}

function getVideoDuration(sourceVideo: Video): number {
  if (sourceVideo.rtime > 0) {
    return sourceVideo.rtime
  }
  if (sourceVideo.video_end_time > sourceVideo.video_start_time) {
    return sourceVideo.video_end_time - sourceVideo.video_start_time
  }
  return Math.max(0, sourceVideo.rtime_ms / 1000)
}

function findTraceEndIndex(events: TimedTraceEvent[], time: number): number {
  let low = 0
  let high = events.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (events[middle].time <= time) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

function resetVideo(): void {
  video.value?.free()
  video.value = undefined
  displayBoard.value = createHiddenBoard(0, 0)
  cursorPosition.value = undefined
  currentTime.value = 0
  duration.value = 0
  timedTraceEvents.value = []
  fileName.value = 'No file selected'
}

function createHiddenBoard(rows: number, columns: number): Board {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => 10))
}

function isBoard(value: unknown): value is Board {
  return Array.isArray(value) &&
    value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'number'))
}

function isVideoRecord(value: unknown): value is MouseRecord {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as {
    event?: {
      is_mouse?: unknown
      unwrap_mouse?: unknown
    }
    mouse_state?: unknown
    time?: unknown
  }
  return typeof record.time === 'number' &&
    typeof record.mouse_state === 'number' &&
    typeof record.event?.is_mouse === 'function' &&
    typeof record.event.unwrap_mouse === 'function'
}

function formatTime(value: number): string {
  return `${value.toFixed(2)}s`
}

function clearAnimationFrame(): void {
  if (animationFrame !== undefined) {
    cancelAnimationFrame(animationFrame)
    animationFrame = undefined
  }
  playbackStartedAt = undefined
}

onBeforeUnmount(() => {
  clearAnimationFrame()
  video.value?.free()
})
</script>
<!-- #endregion script -->

<!-- #region style -->
<style scoped>
.video-example {
  display: inline-flex;
  flex-direction: column;
  gap: 12px;
}

.video-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 14px;
}

.file-button,
.video-toolbar button {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
  padding: 4px 10px;
}

.file-button input {
  display: none;
}

.trace-toggle {
  align-items: center;
  display: inline-flex;
  gap: 6px;
}

.time-slider {
  max-width: 480px;
  width: 100%;
}

.appearance-panel {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  max-width: 720px;
  padding: 8px 10px;
}

.appearance-panel summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.appearance-grid,
.marker-grid {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.appearance-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.marker-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.appearance-grid label,
.marker-fieldset label {
  align-items: center;
  display: grid;
  gap: 4px;
  font-size: 13px;
}

.appearance-grid label {
  grid-template-columns: minmax(72px, max-content) minmax(0, 1fr) auto;
}

.range-control {
  min-width: 0;
  width: 100%;
}

.marker-fieldset {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 8px;
}

.marker-fieldset legend {
  font-size: 13px;
  font-weight: 600;
  padding: 0 4px;
}

.marker-fieldset input[type="color"],
.appearance-grid input[type="color"] {
  height: 28px;
  padding: 0;
  width: 40px;
}

.marker-fieldset select {
  min-width: 0;
}

.video-message {
  color: var(--vp-c-text-2);
  font-size: 13px;
  margin: 0;
  max-width: 480px;
}
</style>
<!-- #endregion style -->
