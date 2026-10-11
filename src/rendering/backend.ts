import type { DrawingContext } from './drawingContext'
import type { BoardTextureKey } from './tiles'

export interface CanvasSurface { width: number; height: number }

/** Platform-specific resource operations; all board drawing and frame ownership live in the shared core. */
export interface RenderingBackend<C extends CanvasSurface, T> {
    readonly defaultOutput: 'canvas' | 'image-bitmap'
    createCanvas(width: number, height: number): C
    getContext(canvas: C): DrawingContext | null
    drawTexture(context: DrawingContext, texture: T, x: number, y: number, size: number): void
    loadTexture(key: BoardTextureKey, url: string, signal: AbortSignal): Promise<T>
    disposeTexture(texture: T): void
    createBitmap(canvas: C): Promise<ImageBitmap>
    /** Cleans resources not yet handed to the core (e.g. unused injected textures). */
    destroy(): void
}
