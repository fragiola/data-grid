import type { RowKey, RowMeta } from "@fragiola/data-grid-react";
import { useMemo, useRef, useState } from "react";
import type { FakeApi } from "../_kit/fake-api";
import { type Entry, listingOf } from "./files";

// A tree a server lists folder by folder (Epic #87, E3.3): app code, copyable. The grid is given
// the rows shown as a count and getters, as `useLocalRows` gives them: each entry, and under an
// expanded folder its entries, or, while they load, rows not loaded yet (`getRow` answers
// `undefined`: they keep their space and render with `data-loading`). Expanding a folder whose
// listing is not here asks the server for it.

/** A row the grid shows: an entry, or a place for one still loading, and its kind. */
interface Shown {
    readonly entry: Entry | undefined;
    readonly meta: RowMeta;
}

/** What the root takes: the rows, their kinds, their keys and the expanded folders. */
export interface LazyTree {
    readonly rowCount: number;
    getRow(index: number): Entry | undefined;
    getRowMeta(index: number): RowMeta | undefined;
    rowKey(entry: Entry): RowKey;
    readonly expandedGroupKeys: readonly RowKey[];
    onExpandedGroupKeysChange(keys: readonly RowKey[]): void;
}

const ROOT = "";

export function useLazyTree(api: FakeApi): LazyTree {
    // the listings here, by folder (the top one to start with: a first page would load it too)
    const [listings, setListings] = useState<
        ReadonlyMap<string, readonly Entry[]>
    >(() => new Map([[ROOT, listingOf(null)]]));
    const [expanded, setExpanded] = useState<readonly RowKey[]>([]);
    const asked = useRef(new Set<string>());

    const shown = useMemo(() => {
        const open = new Set(expanded);
        const rows: Shown[] = [];
        const add = (folderId: string, depth: number, parentIndex?: number) => {
            const items = listings.get(folderId);
            const parent =
                parentIndex === undefined
                    ? undefined
                    : rows[parentIndex]?.entry;
            const count = items?.length ?? parent?.count ?? 0;
            for (let at = 0; at < count; at++) {
                const item = items?.[at];
                const index = rows.length;
                const meta: RowMeta = {
                    depth,
                    parentIndex,
                    setSize: count,
                    posInSet: at + 1,
                    ...(item?.kind === "folder" && item.count > 0
                        ? { expandable: true }
                        : {}),
                };
                rows.push({ entry: item, meta });
                if (item && open.has(item.id)) add(item.id, depth + 1, index);
            }
        };
        add(ROOT, 0);
        return rows;
    }, [listings, expanded]);

    // the same functions while nothing changed: the grid takes new rows only then
    return useMemo(
        () => ({
            rowCount: shown.length,
            getRow: (index) => shown[index]?.entry,
            getRowMeta: (index) => shown[index]?.meta,
            rowKey: (entry) => entry.id,
            expandedGroupKeys: expanded,
            onExpandedGroupKeysChange: (keys) => {
                setExpanded(keys);
                for (const key of keys) {
                    const folderId = String(key);
                    if (listings.has(folderId) || asked.current.has(folderId)) {
                        continue;
                    }
                    asked.current.add(folderId);
                    api.fetchQuery(`list ${folderId}`, () => {
                        const rows = listingOf(folderId);
                        return { rows, total: rows.length };
                    }).then(
                        ({ rows }) => {
                            setListings((current) =>
                                new Map(current).set(folderId, rows),
                            );
                        },
                        // failed: asked again the next time the folder opens (its rows stay
                        // loading meanwhile: collapse it and open it again)
                        () => {
                            asked.current.delete(folderId);
                        },
                    );
                }
            },
        }),
        [shown, expanded, listings, api],
    );
}
