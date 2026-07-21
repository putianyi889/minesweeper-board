export function cloneMatrix<T>(matrix: readonly (readonly T[])[]): T[][] {
    return matrix.map((row) => [...row])
}

export function hasShapeChanged(
    nextMatrix: readonly (readonly unknown[])[],
    priorMatrix: readonly (readonly unknown[])[],
) {
    return nextMatrix.length !== priorMatrix.length ||
        nextMatrix.some((row, rowIndex) => row.length !== priorMatrix[rowIndex]?.length)
}
