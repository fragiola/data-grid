import type { RowSource } from "./types";

/** The row at `index` of a source, or `undefined` while it is not loaded. */
export function rowAt<TRow>(
    source: RowSource<TRow>,
    index: number,
): TRow | undefined {
    if (!Number.isInteger(index) || index < 0) return undefined;
    if ("rows" in source) return source.rows[index];
    return index < source.rowCount ? source.getRow(index) : undefined;
}
