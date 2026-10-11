import { createBoardRenderer, loadWorkerBoardTextures } from '@putianyi888/vue3-minesweeper-board'
import type { BoardLayerName, BoardRenderInput } from '@putianyi888/vue3-minesweeper-board'

type Payload = { id: number; width: number; height: number; cellSize: number; layers: Partial<Record<BoardLayerName, ImageBitmap>>; error?: { message: string } }

function client() {
    const worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' })
    let sequence = 0
    const waiting = new Map<number, { resolve: (payload: Payload) => void; reject: (cause: unknown) => void }>()
    worker.onmessage = ({ data }: MessageEvent<Payload>) => {
        const entry = waiting.get(data.id)
        waiting.delete(data.id)
        if (data.error) entry?.reject(new Error(data.error.message))
        else entry?.resolve(data)
    }
    worker.onerror = (event) => {
        waiting.forEach((entry) => entry.reject(new Error(event.message)))
        waiting.clear()
    }
    return {
        request: (type: string, data: object = {}, transfer: Transferable[] = []) => new Promise<Payload>((resolve, reject) => {
            const id = sequence++
            waiting.set(id, { resolve, reject })
            try { worker.postMessage({ type, id, ...data }, transfer) } catch (cause) {
                waiting.delete(id)
                reject(cause)
            }
        }),
        terminate: () => worker.terminate(),
    }
}

function pixels(source: CanvasImageSource, width: number, height: number) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')!
    context.drawImage(source, 0, 0)
    const data = context.getImageData(0, 0, width, height).data
    canvas.width = 0
    canvas.height = 0
    return data
}

function check(ok: boolean, message: string) { if (!ok) throw new Error(message) }

async function run() {
    const workers = [client(), client()]
    const received: Payload[] = []
    let pngURL: string | undefined
    const main = createBoardRenderer()
    const input: BoardRenderInput = { board: [[10, 1, 11], [12, 2, 16]], size: 23.5, layers: {
        probability: { board: [[0.25, 0, 0], [0.75, 0, 0]], color: () => '#123456' },
        mouseTrace: { opacity: 0, events: [
            { row: 0.5, column: 0.5, action: 'mv', state: 'uu' },
            { row: 1.5, column: 1.5, action: 'lc', state: 'du' },
        ] },
    } }
    try {
        await Promise.all(workers.map(async (worker) => {
            const textures = await loadWorkerBoardTextures()
            try { await worker.request('init', { textures }, Object.values(textures)) } finally {
                // Failed sends close local textures; successful sends leave detached, harmless handles.
                Object.values(textures).forEach((source) => source.close())
            }
        }))
        const first = await workers[0]!.request('render', { input: { ...input, layers: { ...input.layers, probability: false } } })
        received.push(first)
        const second = await workers[1]!.request('render', { input: { ...input, board: [[10, 3, 11], [12, 2, 16]], layers: { ...input.layers, probability: false } } })
        received.push(second)
        await Promise.all(workers.map((worker) => worker.request('destroy')))
        // Workers have released the sender handles and destroyed texture caches. Recipient pixels must remain usable.
        for (const frame of received) {
            check(frame.width === 71 && frame.height === 47 && frame.cellSize === 23.5, 'Incorrect common dimensions.')
            for (const source of Object.values(frame.layers)) check(source.width === 71 && source.height === 47, 'Transferred layer was closed or has a wrong extent.')
            for (const name of ['foreground', 'probability', 'mouseTrace'] as const) {
                const data = pixels(frame.layers[name]!, 71, 47)
                check(data[3] === 0, `${name} background is not transparent.`)
                check(data.some((value, index) => index % 4 === 3 && value > 0), `${name} contains no pixels.`)
            }
        }
        const reference = await main.render(input)
        try {
            for (const name of ['probability', 'mouseTrace'] as const) {
                const expected = pixels(reference.layers[name]!, 71, 47)
                const actual = pixels(first.layers[name]!, 71, 47)
                check(expected.every((value, index) => value === actual[index]), `${name} differs between the main thread and Worker.`)
            }
        } finally { reference.release() }
        const a = pixels(first.layers.foreground!, 71, 47)
        const b = pixels(second.layers.foreground!, 71, 47)
        check(a.some((value, index) => value !== b[index]), 'Different Worker inputs produced the same foreground.')
        // Exercise the Worker-local fetch/Blob/createImageBitmap route using a supported raster format.
        const png = document.createElement('canvas')
        png.width = png.height = 16
        const context = png.getContext('2d')!
        context.fillStyle = '#e04020'
        context.fillRect(0, 0, 16, 16)
        const blob = await new Promise<Blob>((resolve, reject) => png.toBlob((value) => value ? resolve(value) : reject(new Error('PNG preparation failed.')), 'image/png'))
        png.width = png.height = 0
        pngURL = URL.createObjectURL(blob)
        await workers[0]!.request('init', { textureUrls: { up: pngURL } })
        const native = await workers[0]!.request('render', { input: { board: [[10]], size: 8.5, layers: { foreground: false } } })
        received.push(native)
        await workers[0]!.request('destroy')
        const sample = pixels(native.layers.background!, 9, 9)
        check(sample[0] === 224 && sample[1] === 64 && sample[2] === 32 && sample[3] === 255, 'Worker-local PNG loading did not produce the expected pixels.')
        return { passed: true, workers: 2, width: 71, height: 47, cellSize: 23.5, checks: ['textures', 'alpha', 'transfer-and-destroy', 'instance-isolation', 'probability-and-trace-parity', 'worker-local-png-loading'] }
    } finally {
        received.forEach((frame) => Object.values(frame.layers).forEach((source) => source.close()))
        if (pngURL) URL.revokeObjectURL(pngURL)
        main.destroy()
        workers.forEach((worker) => worker.terminate())
    }
}

Object.assign(window, { workerCheck: run })
document.querySelector('#run')!.addEventListener('click', () => {
    const result = document.querySelector('#result')!
    result.textContent = 'Checking…'
    void run().then((value) => { result.textContent = JSON.stringify(value, null, 2) }, (cause) => { result.textContent = String(cause) })
})
