import type { RowKey, RowMeta } from "@fragiola/data-grid-vue";
import { type ComputedRef, computed, shallowRef } from "vue";
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

/** The tree as the root's props (`v-bind="tree"`), a computed ref. Call it in `setup`. */
export function useLazyTree(api: FakeApi): ComputedRef<LazyTree> {
    // the listings here, by folder (the top one to start with: a first page would load it too)
    const listings = shallowRef<ReadonlyMap<string, readonly Entry[]>>(
        new Map([[ROOT, listingOf(null)]]),
    );
    const expanded = shallowRef<readonly RowKey[]>([]);
    const asked = new Set<string>();

    const shown = computed(() => {
        const open = new Set(expanded.value);
        const rows: Shown[] = [];
        const add = (folderId: string, depth: number, parentIndex?: number) => {
            const items = listings.value.get(folderId);
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
    });

    const onExpandedGroupKeysChange = (keys: readonly RowKey[]) => {
        expanded.value = keys;
        for (const key of keys) {
            const folderId = String(key);
            if (listings.value.has(folderId) || asked.has(folderId)) {
                continue;
            }
            asked.add(folderId);
            api.fetchQuery(`list ${folderId}`, () => {
                const rows = listingOf(folderId);
                return { rows, total: rows.length };
            }).then(
                ({ rows }) => {
                    listings.value = new Map(listings.value).set(
                        folderId,
                        rows,
                    );
                },
                // failed: asked again the next time the folder opens (its rows stay loading
                // meanwhile: collapse it and open it again)
                () => {
                    asked.delete(folderId);
                },
            );
        }
    };

    // the same functions while nothing changed: the grid takes new rows only then
    return computed(() => {
        const rows = shown.value;
        return {
            rowCount: rows.length,
            getRow: (index) => rows[index]?.entry,
            getRowMeta: (index) => rows[index]?.meta,
            rowKey: (entry) => entry.id,
            expandedGroupKeys: expanded.value,
            onExpandedGroupKeysChange,
        };
    });
}
