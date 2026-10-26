import type { TouchTraceEvent } from '../components/touchTrace'

type Point = { row: number; column: number }
export interface TouchTraceContact {
    readonly id: number
    readonly down: Point
    position: Point
    /** Cached cell-unit SVG path. Updated only when this contact moves. */
    path: string
}

export function clampTouchTraceIndex(index: number | undefined, length: number) {
    const value = index ?? length
    return Number.isNaN(value) ? 0 : Math.min(length, Math.max(0, Math.trunc(value)))
}

/** Prefix cache, independent of pixels, Vue, playback clocks and recording formats. */
export class TouchTraceModel {
    readonly contacts: TouchTraceContact[] = []
    private readonly active = new Map<number, TouchTraceContact>()
    private events?: readonly TouchTraceEvent[]
    private endIndex = 0

    get activeContacts(): readonly TouchTraceContact[] { return [...this.active.values()] }

    reset() {
        this.contacts.length = 0
        this.active.clear()
        this.events = undefined
        this.endIndex = 0
    }

    /** In-place edits require reset(); the Vue layer observes reactive edits and does this automatically. */
    seek(events: readonly TouchTraceEvent[], endIndex?: number) {
        const end = clampTouchTraceIndex(endIndex, events.length)
        if (events !== this.events || end < this.endIndex) this.reset()
        this.events = events
        for (let index = this.endIndex; index < end; index++) this.append(events[index]!)
        this.endIndex = end
    }

    private append(event: TouchTraceEvent) {
        const finite = Number.isFinite(event.row) && Number.isFinite(event.column) && Number.isFinite(event.id)
        if (event.action === 'down') {
            if (!finite || this.active.has(event.id)) return
            const point = { row: event.row, column: event.column }
            const contact = { id: event.id, down: point, position: point, path: `M ${event.column} ${event.row}` }
            this.contacts.push(contact)
            this.active.set(event.id, contact)
            return
        }
        const contact = this.active.get(event.id)
        if (!contact) return
        if (finite && (event.row !== contact.position.row || event.column !== contact.position.column)) {
            contact.path += ` L ${event.column} ${event.row}`
            contact.position = { row: event.row, column: event.column }
        }
        if (event.action === 'up' || event.action === 'cancel') this.active.delete(event.id)
    }
}
