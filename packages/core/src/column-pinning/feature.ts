import type { Axis } from "../axis/axis";
import {
    type DataGridFeature,
    defineFeature,
    type PinnedColumns,
} from "../feature/feature";
import { pinnedPartsOf } from "../header/header";
import type { Column } from "../model/types";
import type { PinnedColumnKeys, PinningTypes } from "./types";

// Pinned columns (Epic #85, E1.1; a feature since Epic #148): a column's `pinned` keeps it at the
// view's start or end while the others scroll sideways. The core keeps the parts as declared (the
// columns a `pinned` puts in one part: what validation, spans and moves keep to, so a column list
// means the same with and without pinning) and the layers the engine writes (sticky cells and
// their insets, the windows between the strips: zeros without pinning); pinning decides which
// columns are pinned in effect, and how wide the strips are.

/** No column pinned in effect (none declared, or pinned ones as wide as the view or wider). */
const NONE: PinnedColumns = Object.freeze({
    startCount: 0,
    startWidth: 0,
    endCount: 0,
    endWidth: 0,
});

/**
 * The columns pinned in effect: the leading ones pinned at the start and the trailing ones pinned
 * at the end, while together they leave part of the view to scroll. As wide as the view or wider
 * (a narrow screen), they would hide every other column: they scroll with the rest until the view
 * is wider again. Before the view is measured (0 wide), they are pinned.
 */
function pinnedColumns(
    columns: readonly Column<unknown, unknown>[],
    columnAxis: Axis,
    viewportWidth: number,
): PinnedColumns {
    const { startCount, endFrom } = pinnedPartsOf(columns);
    if (startCount === 0 && endFrom === columns.length) return NONE;
    const startWidth = columnAxis.offsetOf(startCount);
    const endWidth = columnAxis.totalSize - columnAxis.offsetOf(endFrom);
    if (viewportWidth !== 0 && startWidth + endWidth >= viewportWidth) {
        return NONE;
    }
    return {
        startCount,
        startWidth,
        endCount: columnAxis.count - endFrom,
        endWidth,
    };
}

/** The keys pinned as declared, worked out once per list of columns (the state's never change). */
const keysOf = new WeakMap<object, PinnedColumnKeys>();

function pinnedKeys(
    columns: readonly Column<unknown, unknown>[],
): PinnedColumnKeys {
    let keys = keysOf.get(columns);
    if (!keys) {
        const { startCount, endFrom } = pinnedPartsOf(columns);
        keys = {
            start: columns.slice(0, startCount).map((column) => column.key),
            end: columns.slice(endFrom).map((column) => column.key),
        };
        keysOf.set(columns, keys);
    }
    return keys;
}

/** Pinning's definition: every grid installing it shares it. */
const PINNING = defineFeature<PinningTypes>({
    name: "columnPinning",
    queries: {
        "pinned-column-keys": (state) => pinnedKeys(state.columns),
    },
    pinnedColumns,
});

/**
 * Pinned columns (`@fragiola/data-grid/column-pinning`): install it on a grid (`features:
 * [columnPinning()]`) for its columns' `pinned` to keep them in view while the others scroll.
 * Without it, every column scrolls.
 */
export function columnPinning(): DataGridFeature<PinningTypes> {
    return PINNING;
}
