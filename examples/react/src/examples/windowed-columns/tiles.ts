import type { Range } from "@fragiola/data-grid-react";
import type { FakeApi } from "../_kit/fake-api";

// A cache of tiles: blocks of rows × blocks of columns, each fetched once. App code: the grid only
// says which rows and columns are rendered.

export interface TileCache {
    /** the value at a cell, or `undefined` while its tile is not loaded */
    get(rowIndex: number, columnIndex: number): number | undefined;
    /** fetches the tiles covering the rendered rows and columns that are not loaded or loading */
    ensure(rows: Range, columns: Range): void;
    /** listens to tiles arriving, with the rows each covers; returns the unsubscription */
    subscribe(listener: (rows: Range) => void): () => void;
}

export function createTileCache(
    api: FakeApi,
    size: { rows: number; columns: number },
    total: { rows: number; columns: number },
    cellAt: (rowIndex: number, columnIndex: number) => number,
): TileCache {
    const tiles = new Map<string, number[][]>();
    const loading = new Set<string>();
    const listeners = new Set<(rows: Range) => void>();
    const id = (rowBlock: number, columnBlock: number) =>
        `${rowBlock}:${columnBlock}`;

    return {
        get(rowIndex, columnIndex) {
            const tile = tiles.get(
                id(
                    Math.floor(rowIndex / size.rows),
                    Math.floor(columnIndex / size.columns),
                ),
            );
            return tile?.[rowIndex % size.rows]?.[columnIndex % size.columns];
        },
        ensure(rows, columns) {
            if (rows.start === rows.end || columns.start === columns.end)
                return;
            for (
                let r = Math.floor(rows.start / size.rows);
                r <= Math.floor((rows.end - 1) / size.rows);
                r++
            ) {
                for (
                    let c = Math.floor(columns.start / size.columns);
                    c <= Math.floor((columns.end - 1) / size.columns);
                    c++
                ) {
                    const key = id(r, c);
                    if (tiles.has(key) || loading.has(key)) continue;
                    loading.add(key);
                    const rowRange = [
                        r * size.rows,
                        Math.min((r + 1) * size.rows, total.rows),
                    ] as const;
                    const columnRange = [
                        c * size.columns,
                        Math.min((c + 1) * size.columns, total.columns),
                    ] as const;
                    api.fetchTile(rowRange, columnRange, cellAt).then(
                        (tile) => {
                            loading.delete(key);
                            tiles.set(key, tile);
                            const [start, end] = rowRange;
                            for (const listener of listeners) {
                                listener({ start, end });
                            }
                        },
                        // a failed tile is asked for again the next time it is in view
                        () => loading.delete(key),
                    );
                }
            }
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
