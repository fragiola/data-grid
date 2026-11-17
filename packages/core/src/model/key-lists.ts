import { sameList } from "../utils/utils";

// Lists of column and group keys (Epics #75, #85): a column order, the collapsed groups. Pure, and
// shared by the features that keep one (`columnReorder()`, `columnGroupCollapse()`, Epic #148):
// the main entry never imports it.

/** The keys kept of a value: its strings, each once (an option's, lenient as the others). */
export function keptOrder(columnOrder: unknown): readonly string[] {
    if (!Array.isArray(columnOrder)) return [];
    return [
        ...new Set(
            columnOrder.filter((key): key is string => typeof key === "string"),
        ),
    ];
}

/** Whether two orders list the same keys in the same order. */
export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
    return sameList(a, b, Object.is);
}
