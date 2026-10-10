# API

## Imports

```ts
import MinesweeperBoard, {
  BoardBackground,
  BoardForeground,
  BoardProbability,
  Counter,
  createBoardRenderer,
  BoardRenderError,
  defaultMouseTraceColor,
  defaultMouseTraceMarkers,
  innerBorderClass,
  MouseTrace,
  mouseTraceActions,
  mouseTraceMarkerActions,
  mouseTraceMarkerShapes,
  mouseTraceStates,
  outerBorderClass,
} from '@putianyi888/vue3-minesweeper-board'
import type {
  BoardRenderInput,
  BoardRenderFrame,
  BoardRenderer,
  LayerRenderHandle,
  LayerRenderFrame,
  MouseTraceAction,
  MouseTraceColor,
  MouseTraceEvent,
  MouseTraceMarker,
  MouseTraceMarkerAction,
  MouseTraceMarkers,
  MouseTraceMarkerShape,
  MouseTraceResolvedMarker,
  MouseTraceState,
} from '@putianyi888/vue3-minesweeper-board'

import '@putianyi888/vue3-minesweeper-board/style.css'
```

## Components

- [MinesweeperBoard](./minesweeper-board)
- [BoardBackground](./board-background)
- [BoardForeground](./board-foreground)
- [BoardProbability](./board-probability)
- [MouseTrace](./mouse-trace)
- [Counter](./counter)

## Utilities

- [Canvas / Bitmap Rendering](./rendering)
- [Border Classes](./border-classes)
