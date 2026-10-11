import type { RenderingBackend } from './backend'
import { BoardRenderError } from './errors'

export function loadDomTexture(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.crossOrigin = 'anonymous'
        const cleanup = () => {
            signal.removeEventListener('abort', abort)
            image.onload = null
            image.onerror = null
        }
        const fail = (cause: unknown) => {
            cleanup()
            image.src = ''
            reject(cause)
        }
        const abort = () => fail(new BoardRenderError('DESTROYED', 'The texture loader was aborted.'))
        const ready = () => {
            cleanup()
            if (signal.aborted) { abort(); return }
            if (image.naturalWidth === 0 || image.naturalHeight === 0) {
                fail(new Error('The decoded image has no pixels.'))
            } else resolve(image)
        }
        if (signal.aborted) { abort(); return }
        signal.addEventListener('abort', abort, { once: true })
        try {
            if (typeof image.decode === 'function') {
                image.src = url
                void image.decode().then(ready, fail)
            } else {
                image.onload = ready
                image.onerror = () => fail(new Error(`Failed to load ${url}`))
                image.src = url
            }
        } catch (cause) { fail(cause) }
    })
}

export function createDomBackend(): RenderingBackend<HTMLCanvasElement, HTMLImageElement> {
    return {
        defaultOutput: 'canvas',
        createCanvas: (width, height) => {
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            return canvas
        },
        getContext: (canvas) => canvas.getContext('2d'),
        drawTexture: (context, texture, x, y, size) => (context as CanvasRenderingContext2D).drawImage(texture, x, y, size, size),
        loadTexture: (_key, url, signal) => loadDomTexture(url, signal),
        disposeTexture: (image) => { image.src = '' },
        createBitmap: (canvas) => {
            if (typeof createImageBitmap !== 'function') {
                throw new BoardRenderError('BITMAP_UNAVAILABLE', 'ImageBitmap output requires createImageBitmap.')
            }
            return createImageBitmap(canvas)
        },
        destroy: () => {},
    }
}
