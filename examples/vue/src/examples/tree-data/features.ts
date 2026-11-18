import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { rowGrouping } from "@fragiola/data-grid-vue/row-grouping";
import { rowSelection } from "@fragiola/data-grid-vue/row-selection";
import { search } from "@fragiola/data-grid-vue/search";
import { sorting } from "@fragiola/data-grid-vue/sorting";

// the features the grid installs: sorting (without it, a sortable column never sorts), search
// (the search text: `useLocalRows` applies it to the tree in memory, the grid's model holds it),
// cell navigation (the keys, the active cell, the tab stop), row selection, pinned columns
// (without it, every column scrolls), row grouping (a group's toggle and keys; without it,
// nothing expands). Shared by the grid and the tree in memory, which runs their stages
export const features = [
    sorting(),
    search(),
    navigation(),
    rowSelection(),
    columnPinning(),
    rowGrouping(),
] as const;
