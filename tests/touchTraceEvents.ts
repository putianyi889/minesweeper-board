import type { TouchTraceEvent } from '../src/components/touchTrace'

export const interleavedTouches: readonly TouchTraceEvent[] = [
    { id: 10, row: 0.5, column: 0.5, action: 'down' },
    { id: 20, row: 1.5, column: 1.5, action: 'down' },
    { id: 10, row: 0.5, column: 2.5, action: 'move' },
    { id: 20, row: 1.5, column: 1.5, action: 'up' },
    { id: 10, row: 0.5, column: 2.5, action: 'cancel' },
    { id: 30, row: 2.5, column: 2.5, action: 'down' },
]

/** 500 unique contacts, two interleaved contacts at a time, 10,000 events. */
export function makeTouchRecording(): TouchTraceEvent[] {
    const events: TouchTraceEvent[] = []
    for (let pair = 0; pair < 250; pair++) {
        for (let point = 0; point < 20; point++) {
            for (let finger = 0; finger < 2; finger++) {
                events.push({
                    id: pair * 2 + finger + 100,
                    row: (pair + finger) % 15 + 0.5,
                    column: 0.5 + point,
                    action: point === 0 ? 'down' : point === 19 ? 'up' : 'move',
                })
            }
        }
    }
    return events
}
