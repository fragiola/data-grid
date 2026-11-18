import type { GridSummaryCellInfo } from "@fragiola/data-grid/summary-rows";
import type { ReactNode } from "react";

// The summary rows' parts' types (the summary rows feature's, Epic #151).

/** A summary row's cell, as `SummaryCells` hands it to its children. */
export type SummaryCellInfo<TRow = unknown> = GridSummaryCellInfo<
    TRow,
    ReactNode
>;
