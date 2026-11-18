import type { FeatureTypes } from "../feature/feature";
import type { SummaryRowCounts, SummaryRowView } from "../model/types";

/** What the summary rows feature adds to a root's props: how many there are, and how tall. */
export interface SummaryRowsProps {
    /**
     * how many summary rows the grid has: at the top, under the header, and at the bottom, at
     * the view's bottom edge (default none). Each column's `renderSummaryCell` draws their
     * cells from the app's own values; the adapters' `Summary` (from their `/summary-rows`)
     * renders them
     */
    summaryRows?:
        | { readonly top?: number; readonly bottom?: number }
        | undefined;
    /** a summary row's height in pixels (default 35) */
    summaryRowHeight?: number | undefined;
}

/** Summary rows' types (Epic #86, E2.1; a feature since Epic #151). */
export interface SummaryRowsTypes extends FeatureTypes {
    readonly options: {
        /** how many summary rows the grid has at the top and at the bottom (default none) */
        readonly summaryRows?:
            | { readonly top?: number; readonly bottom?: number }
            | undefined;
        /** a summary row's height in pixels (default 35) */
        readonly summaryRowHeight?: number | undefined;
    };
    readonly commands: {
        /**
         * replaces how many summary rows the grid has at the top and at the bottom (a count left
         * out is 0): whole numbers, 0 or more. Returns them
         */
        "summary-rows.set": {
            payload: {
                readonly top?: number | undefined;
                readonly bottom?: number | undefined;
            };
            result: SummaryRowCounts;
        };
        /**
         * tells that the figures behind the summary rows changed (the app's data a column's
         * `renderSummaryCell` or `colSpan` reads, its columns the same): their cells are drawn
         * and spanned again. Nothing to tell without summary rows. Returns the summary revision
         */
        "summary-rows.changed": {
            payload: Record<string, never>;
            result: number;
        };
    };
    readonly queries: {
        /** how many summary rows the grid has, at the top and at the bottom */
        "summary-rows": { payload: undefined; result: SummaryRowCounts };
        /** a summary row's height */
        "summary-row-height": { payload: undefined; result: number };
        /** the summary row at a row index (its position and index), or `undefined` for another row */
        "summary-row-by": {
            payload: { readonly rowIndex: number };
            result: SummaryRowView | undefined;
        };
    };
    readonly props: SummaryRowsProps;
}
