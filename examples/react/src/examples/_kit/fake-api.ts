// A pretend server: answers after a delay and logs every request, so an example can show what it
// asked for. App code, copyable: swap `load` for a `fetch` to your API.

export interface Request {
    readonly id: number;
    readonly kind: "rows" | "page" | "tile" | "query";
    readonly description: string;
    /** the first item asked for (a row, or a tile's first row) */
    readonly start: number;
    /** after the last one */
    readonly end: number;
}

export interface FakeApi {
    /** rows `[start, end)`, as values computed by `rowAt` */
    fetchRows<T>(
        start: number,
        end: number,
        rowAt: (index: number) => T,
    ): Promise<T[]>;
    /** page `page` of `size` rows, up to `total`; an empty page past the end */
    fetchPage<T>(
        page: number,
        size: number,
        total: number,
        rowAt: (index: number) => T,
    ): Promise<T[]>;
    /** a tile: rows `[rowStart, rowEnd)` × columns `[columnStart, columnEnd)` */
    fetchTile<T>(
        rows: readonly [number, number],
        columns: readonly [number, number],
        cellAt: (rowIndex: number, columnIndex: number) => T,
    ): Promise<T[][]>;
    /**
     * a query a server answers (sorted, filtered, paged): `describe` says what was asked, for the
     * log; `answer` is the server's work
     */
    fetchQuery<T>(
        describe: string,
        answer: () => { readonly rows: readonly T[]; readonly total: number },
    ): Promise<{ readonly rows: readonly T[]; readonly total: number }>;
    /** every request so far, oldest first */
    readonly log: readonly Request[];
    /** listens to new requests; returns the unsubscription */
    subscribe(listener: () => void): () => void;
}

/** A pretend server answering after `latency` milliseconds. */
export function createFakeApi(latency = 400): FakeApi {
    let log: Request[] = [];
    const listeners = new Set<() => void>();
    let id = 0;

    function record(request: Omit<Request, "id">) {
        id += 1;
        log = [...log, { id, ...request }];
        for (const listener of listeners) listener();
    }

    function later<T>(value: () => T): Promise<T> {
        return new Promise((resolve) => {
            setTimeout(() => resolve(value()), latency);
        });
    }

    return {
        fetchRows(start, end, rowAt) {
            record({
                kind: "rows",
                description: `rows ${start}–${end - 1}`,
                start,
                end,
            });
            return later(() =>
                Array.from({ length: end - start }, (_, i) => rowAt(start + i)),
            );
        },
        fetchPage(page, size, total, rowAt) {
            const start = page * size;
            const end = Math.min(start + size, total);
            record({
                kind: "page",
                description: `page ${page + 1} (rows ${start}–${end - 1})`,
                start,
                end,
            });
            return later(() =>
                Array.from({ length: Math.max(0, end - start) }, (_, i) =>
                    rowAt(start + i),
                ),
            );
        },
        fetchTile([rowStart, rowEnd], [columnStart, columnEnd], cellAt) {
            record({
                kind: "tile",
                description: `rows ${rowStart}–${rowEnd - 1} × columns ${columnStart}–${columnEnd - 1}`,
                start: rowStart,
                end: rowEnd,
            });
            return later(() =>
                Array.from({ length: rowEnd - rowStart }, (_, r) =>
                    Array.from({ length: columnEnd - columnStart }, (_, c) =>
                        cellAt(rowStart + r, columnStart + c),
                    ),
                ),
            );
        },
        fetchQuery(describe, answer) {
            record({ kind: "query", description: describe, start: 0, end: 0 });
            return later(answer);
        },
        get log() {
            return log;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
