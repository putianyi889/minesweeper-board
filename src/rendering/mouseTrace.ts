import { defaultMouseTraceColor, defaultMouseTraceMarkers } from '../components/mouseTrace'
import type { MouseTraceEvent, MouseTraceMarker, MouseTraceMarkerAction, MouseTraceState } from '../components/mouseTrace'
import type { MouseTraceSettings } from './types'

type CanvasRect = { x: number; y: number; width: number; height: number }

export function createMouseTracePainter(settings: MouseTraceSettings, cellSize: number) {
    const rangeStart = clampIndex(settings.startIndex ?? 0, 0, settings.events.length)
    const rangeEnd = clampIndex(settings.endIndex ?? settings.events.length, rangeStart, settings.events.length)
    function drawRange(context2d: CanvasRenderingContext2D, start: number, end: number) {
        drawSegments(context2d, start, end)
        drawMarkers(context2d, start, end)
    }

    function drawSegments(context2d: CanvasRenderingContext2D, start: number, end: number) {
        const clampedStart = clampIndex(start, rangeStart, rangeEnd)
        const clampedEnd = clampIndex(end, clampedStart, rangeEnd)
        for (let index = clampedStart; index < clampedEnd - 1; index += 1) {
            drawSegment(context2d, index)
        }
    }

    function drawSegment(context2d: CanvasRenderingContext2D, index: number) {
        const event = settings.events[index]
        const nextEvent = settings.events[index + 1]
        if (event === undefined || nextEvent === undefined || !isFiniteEvent(event) || !isFiniteEvent(nextEvent)) {
            return
        }

        const start = getEventPosition(event)
        const end = getEventPosition(nextEvent)
        context2d.save()
        context2d.beginPath()
        context2d.lineCap = 'round'
        context2d.lineJoin = 'round'
        context2d.lineWidth = Math.max(1, (settings.lineWidth ?? 0.08) * cellSize)
        context2d.strokeStyle = getColor(event.state)
        context2d.moveTo(start.x, start.y)
        context2d.lineTo(end.x, end.y)
        context2d.stroke()
        context2d.restore()
    }

    function drawMarkers(context2d: CanvasRenderingContext2D, start: number, end: number) {
        const clampedStart = clampIndex(start, rangeStart, rangeEnd)
        const clampedEnd = clampIndex(end, clampedStart, rangeEnd)
        for (let index = clampedStart; index < clampedEnd; index += 1) {
            drawMarker(context2d, index)
        }
    }

    function drawMarker(context2d: CanvasRenderingContext2D, index: number) {
        const event = settings.events[index]
        if (event === undefined || event.action === 'mv' || !isFiniteEvent(event)) {
            return
        }
        const marker = getMarker(event.action)
        if (marker === undefined) {
            return
        }

        const { x, y } = getEventPosition(event)
        const size = Math.max(1, marker.size * cellSize)
        const halfSize = size / 2
        const strokeWidth = Math.max(1, marker.strokeWidth * cellSize)

        context2d.save()
        context2d.globalAlpha = clampOpacity(marker.opacity)
        context2d.fillStyle = marker.fill
        context2d.strokeStyle = marker.stroke
        context2d.lineCap = 'round'
        context2d.lineJoin = 'round'
        context2d.lineWidth = strokeWidth

        if (marker.shape === 'cross') {
            context2d.beginPath()
            context2d.moveTo(x - halfSize, y - halfSize)
            context2d.lineTo(x + halfSize, y + halfSize)
            context2d.moveTo(x + halfSize, y - halfSize)
            context2d.lineTo(x - halfSize, y + halfSize)
            context2d.stroke()
        } else if (marker.shape === 'square') {
            drawClosedPath(context2d, () => {
                context2d.rect(x - halfSize, y - halfSize, size, size)
            }, marker)
        } else if (marker.shape === 'diamond') {
            drawClosedPath(context2d, () => {
                context2d.moveTo(x, y - halfSize)
                context2d.lineTo(x + halfSize, y)
                context2d.lineTo(x, y + halfSize)
                context2d.lineTo(x - halfSize, y)
                context2d.closePath()
            }, marker)
        } else {
            drawClosedPath(context2d, () => {
                context2d.arc(x, y, halfSize, 0, Math.PI * 2)
            }, marker)
        }
        context2d.restore()
    }

    function drawClosedPath(context2d: CanvasRenderingContext2D, drawPath: () => void, marker: Required<MouseTraceMarker>) {
        context2d.beginPath()
        drawPath()
        if (marker.shape !== 'ring' && marker.fill !== 'transparent') {
            context2d.fill()
        }
        context2d.stroke()
    }

    function fillBackground(context2d: CanvasRenderingContext2D, rect: CanvasRect) {
        context2d.save()
        context2d.fillStyle = `rgba(0, 0, 0, ${clampOpacity(settings.opacity ?? 0.2)})`
        context2d.fillRect(rect.x, rect.y, rect.width, rect.height)
        context2d.restore()
    }

    function getEventPosition(event: MouseTraceEvent) {
        return {
            x: event.column * cellSize,
            y: event.row * cellSize,
        }
    }

    function getColor(state: MouseTraceState) {
        return settings.color?.[state] ?? defaultMouseTraceColor[state]
    }

    function getMarker(action: MouseTraceMarkerAction) {
        const marker = settings.markers?.[action]
        if (marker === false) {
            return undefined
        }
        return { ...defaultMouseTraceMarkers[action], ...marker }
    }

    return { drawRange, drawSegments, drawSegment, drawMarkers, drawMarker, fillBackground, getMarker, getEventPosition }
}

function isFiniteEvent(event: MouseTraceEvent) {
    return Number.isFinite(event.row) && Number.isFinite(event.column)
}

function clampIndex(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
        return min
    }
    return Math.min(max, Math.max(min, Math.trunc(value)))
}

function clampOpacity(value: number) {
    if (!Number.isFinite(value)) {
        return 0
    }
    return Math.min(1, Math.max(0, value))
}

