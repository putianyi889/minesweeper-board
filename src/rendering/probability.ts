import type { DrawingContext } from './drawingContext'
export type ProbabilityColor = (value: number, rowIndex: number, columnIndex: number) => string

export function drawProbabilityCell(
    context: DrawingContext,
    value: number,
    row: number,
    column: number,
    size: number,
    sourceBoard: readonly (readonly number[])[] | undefined,
    color: ProbabilityColor = () => '#000000',
) {
    const x = column * size
    const y = row * size
    context.clearRect(x, y, size, size)
    const sourceCell = sourceBoard?.[row]?.[column]
    if (sourceCell !== undefined && sourceCell !== 10 && sourceCell !== 12 && sourceCell !== 18) {
        return
    }
    const probability = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
    const text = String(Math.round(probability * 100))
    context.fillStyle = color(probability, row, column)
    context.font = `${Math.max(1, size * (text === '100' ? 0.42 : 0.54))}px sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, x + size / 2, y + size / 2)
}
