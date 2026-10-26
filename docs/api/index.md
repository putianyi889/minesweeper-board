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
  TouchTrace,
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
  TouchTraceEvent,
  TouchTraceAction,
  TouchTraceMarker,
} from '@putianyi888/vue3-minesweeper-board'

import '@putianyi888/vue3-minesweeper-board/style.css'
```

## Components

- [MinesweeperBoard](./minesweeper-board)
- [BoardBackground](./board-background)
- [BoardForeground](./board-foreground)
- [BoardProbability](./board-probability)
- [MouseTrace](./mouse-trace)
- [TouchTrace](./touch-trace)
- [Counter](./counter)

## Utilities

- [Canvas / Bitmap Rendering](./rendering)
- [Worker Rendering](./worker-rendering)
- [Border Classes](./border-classes)
