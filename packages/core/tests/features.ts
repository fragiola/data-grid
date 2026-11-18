import { createDataGridModel, type ModelOptions } from "../src";
import { clipboard } from "../src/clipboard";
import { columnGroupCollapse } from "../src/column-group-collapse";
import { columnPinning } from "../src/column-pinning";
import { columnReorder } from "../src/column-reorder";
import { columnResize } from "../src/column-resize";
import { editing } from "../src/editing";
import { fillHandle } from "../src/fill";
import { navigation } from "../src/navigation";
import { cellRange } from "../src/range";
import { rowExpansion } from "../src/row-expansion";
import { rowGrouping } from "../src/row-grouping";
import { rowReorder } from "../src/row-reorder";
import { rowSelection } from "../src/row-selection";
import { cellSpans } from "../src/spans";
import { summaryRows } from "../src/summary-rows";

// The features every test of a behaviour they took over installs (Epics #144, #146, #148):
// navigation, row selection, cell ranges, the clipboard, the fill handle, cell editing and the
// column features (resizing, reordering, pinning, collapsible groups), as the grid had them
// before they were features. A test of a grid without them creates its model without.

/** Every feature of Epics #144, #146 and #148, in their requirements' order. */
export const FEATURES = [
    navigation(),
    rowSelection(),
    cellRange(),
    clipboard(),
    fillHandle(),
    editing(),
    columnResize(),
    columnReorder(),
    columnPinning(),
    columnGroupCollapse(),
    cellSpans(),
    rowGrouping(),
    rowExpansion(),
    summaryRows(),
    rowReorder(),
] as const;

/** Their types. */
export type Features = typeof FEATURES;

/** A model with every feature of Epics #144, #146 and #148 installed (`createDataGridModel`'s options otherwise). */
export function gridModel<TRow, TNode = unknown>(
    options: ModelOptions<TRow, TNode, Features> = {},
) {
    return createDataGridModel<TRow, TNode, Features>({
        features: FEATURES,
        ...options,
    });
}
