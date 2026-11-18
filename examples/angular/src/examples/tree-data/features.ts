import { columnPinning } from "@fragiola/data-grid-angular/column-pinning";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { rowGrouping } from "@fragiola/data-grid-angular/row-grouping";
import { rowSelection } from "@fragiola/data-grid-angular/row-selection";
import { search } from "@fragiola/data-grid-angular/search";
import { sorting } from "@fragiola/data-grid-angular/sorting";

// the features the grid in memory installs: sorting (the local rows' sort needs it, or no column
// sorts), search (the search text: `injectLocalRows` applies it to the tree, the grid's model
// holds it), cell navigation (the keys, the active cell, the tab stop), row selection, pinned
// columns (without it, every column scrolls), row grouping (a folder expands). Shared by the grid
// and the tree in memory, which runs their stages
export const MEMORY_FEATURES = [
    sorting(),
    search(),
    navigation(),
    rowSelection(),
    columnPinning(),
    rowGrouping(),
];
