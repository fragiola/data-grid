import { createDataGridModel, type ModelOptions } from "../src";
import { clipboard } from "../src/clipboard";
import { fillHandle } from "../src/fill";
import { navigation } from "../src/navigation";
import { cellRange } from "../src/range";
import { rowSelection } from "../src/row-selection";

// The features every test of a behaviour they took over installs (Epic #144): navigation, row
// selection, cell ranges, the clipboard and the fill handle, as the grid had them before they
// were features. A test of a grid without them creates its model without.

/** Every feature of Epic #144, in their requirements' order. */
export const FEATURES = [
    navigation(),
    rowSelection(),
    cellRange(),
    clipboard(),
    fillHandle(),
] as const;

/** Their types. */
export type Features = typeof FEATURES;

/** A model with every feature of Epic #144 installed (`createDataGridModel`'s options otherwise). */
export function gridModel<TRow, TNode = unknown>(
    options: ModelOptions<TRow, TNode, Features> = {},
) {
    return createDataGridModel<TRow, TNode, Features>({
        features: FEATURES,
        ...options,
    });
}
