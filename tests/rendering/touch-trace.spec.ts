import { describe, expect, it } from 'vitest'
import { TouchTraceModel } from '../../src/rendering/touchTrace'
import { interleavedTouches, makeTouchRecording } from '../touchTraceEvents'

describe('touch prefix model', () => {
    it('keeps interleaved contacts independent and keeps down markers and terminated endpoints', () => {
        const model = new TouchTraceModel()
        model.seek(interleavedTouches, 3)
        expect(model.activeContacts.map((contact) => contact.id)).toEqual([10, 20])
        expect(model.contacts.map((contact) => contact.path)).toEqual(['M 0.5 0.5 L 2.5 0.5', 'M 1.5 1.5'])
        model.seek(interleavedTouches, 4)
        expect(model.activeContacts.map((contact) => contact.id)).toEqual([10])
        model.seek(interleavedTouches, 5)
        expect(model.activeContacts).toEqual([])
        expect(model.contacts.map((contact) => contact.down)).toEqual([{ row: 0.5, column: 0.5 }, { row: 1.5, column: 1.5 }])
        model.seek(interleavedTouches)
        expect(model.contacts).toHaveLength(3)
        expect(model.activeContacts.map((contact) => contact.id)).toEqual([30])
        expect(model.contacts[2]!.path).toBe('M 2.5 2.5')
        model.seek(interleavedTouches, 3)
        expect(model.activeContacts.map((contact) => contact.id)).toEqual([10, 20])
        expect(model.contacts).toHaveLength(2)
        model.seek(interleavedTouches, 0)
        expect(model.contacts).toEqual([])
        expect(model.activeContacts).toEqual([])
    })

    it('includes the final up/cancel coordinate without adding a down or an active marker', () => {
        const model = new TouchTraceModel()
        model.seek([
            { id: 4, row: 0.5, column: 0.5, action: 'down' },
            { id: 4, row: 2, column: -1, action: 'up' },
            { id: 9, row: 1, column: 1, action: 'down' },
            { id: 9, row: 3, column: 4, action: 'cancel' },
        ])
        expect(model.contacts.map((contact) => contact.path)).toEqual(['M 0.5 0.5 L -1 2', 'M 1 1 L 4 3'])
        expect(model.contacts).toHaveLength(2)
        expect(model.activeContacts).toEqual([])
    })

    it('clamps indices, handles empty/replaced recordings, and preserves active contacts at EOF', () => {
        const model = new TouchTraceModel()
        model.seek(interleavedTouches, Infinity)
        expect(model.activeContacts[0]!.id).toBe(30)
        model.seek(interleavedTouches, -5)
        expect(model.contacts).toEqual([])
        model.seek(interleavedTouches, 2.9)
        expect(model.contacts).toHaveLength(2)
        model.seek(interleavedTouches, NaN)
        expect(model.contacts).toEqual([])
        model.seek(interleavedTouches, 99)
        model.seek([])
        expect(model.contacts).toEqual([])
        expect(model.activeContacts).toEqual([])
    })

    it('only reads newly processed events on forward playback and retains no contact-sized pixel surfaces', () => {
        const source = makeTouchRecording()
        let reads = 0
        const events = new Proxy(source, { get(target, property, receiver) {
            if (typeof property === 'string' && /^\d+$/.test(property)) reads++
            return Reflect.get(target, property, receiver)
        } })
        const model = new TouchTraceModel()
        for (let end = 0; end <= events.length; end++) model.seek(events, end)
        expect(reads).toBe(10_000)
        expect(model.contacts).toHaveLength(500)
        expect(model.activeContacts).toEqual([])
        expect(model.contacts.every((contact) => typeof contact.path === 'string')).toBe(true)
        model.reset()
        expect(model.contacts).toEqual([])
    })
})
