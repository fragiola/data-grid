import { createDataGridModel, type ModelOptions } from "../src";
import { clipboard } from "../src/clipboard";
import { editing } from "../src/editing";
import { fillHandle } from "../src/fill";
import { navigation } from "../src/navigation";
import { cellRange } from "../src/range";
import { rowSelection } from "../src/row-selection";

// The features every test of a behaviour they took over installs (Epics #144, #146): navigation,
// row selection, cell ranges, the clipboard, the fill handle and cell editing, as the grid had
// them before they were features. A test of a grid without them creates its model without.

/** Every feature of Epics #144 and #146, in their requirements' order. */
export const FEATURES = [
    navigation(),
    rowSelection(),
    cellRange(),
    clipboard(),
    fillHandle(),
    editing(),
] as const;

/** Their types. */
export type Features = typeof FEATURES;

/** A model with every feature of Epics #144 and #146 installed (`createDataGridModel`'s options otherwise). */
export function gridModel<TRow, TNode = unknown>(
    options: ModelOptions<TRow, TNode, Features> = {},
) {
    return createDataGridModel<TRow, TNode, Features>({
        features: FEATURES,
        ...options,
    });
}
