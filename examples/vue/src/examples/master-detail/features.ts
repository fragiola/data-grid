import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { rowExpansion } from "@fragiola/data-grid-vue/row-expansion";

// the features the orders grid installs: cell navigation (the keys, the active cell, the tab
// stop), pinned columns (without it, every column scrolls), row expansion (a row's detail). Its
// parts read them to type the expanded rows' keys
export const FEATURES = [
    navigation(),
    columnPinning(),
    rowExpansion(),
] as const;

export type Features = typeof FEATURES;
