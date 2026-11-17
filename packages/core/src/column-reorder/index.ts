// @fragiola/data-grid/column-reorder: column reordering (Epic #75; a feature since Epic #148). An
// opt-in entry point: the grid's own entry never imports it, and an app that never installs it
// never ships it (the columns keep their declared order).

export { keptOrder, sameOrder } from "../model/key-lists";
export { columnReorder } from "./feature";
export type {
    ColumnReorderProps,
    ColumnReorderState,
    ColumnReorderTypes,
    ColumnReorderView,
} from "./types";
