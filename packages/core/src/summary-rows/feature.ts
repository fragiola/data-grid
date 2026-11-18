import { type DataGridFeature, defineFeature } from "../feature/feature";
import { DEFAULT_ROW_HEIGHT, reconcile } from "../model/model";
import { done, invalid } from "../model/result";
import {
    NO_SUMMARY_ROWS,
    summaryRowAt,
    summaryRowCounts,
} from "../model/summary";
import type { SummaryRowsTypes } from "./types";

// Summary rows (Epic #86, E2.1; a feature since Epic #151): rows the app fills (totals, counts,
// averages) under the header and at the view's bottom edge. The feature sets how many there are
// (`summary-rows.set`, its options and props) and tells their figures changed
// (`summary-rows.changed`); the adapters' `Summary`, `SummaryRows`, `SummaryRow` and
// `SummaryCells` (from their `/summary-rows`) render them. Their place in the grid is the core's:
// the row bands (their row indexes extend the grid's on both sides), their sticky layers, the
// body between them and their height (a size, D7). Without it, a grid has none.

/** The summary rows' definition: every grid installing it shares it. */
const SUMMARY_ROWS = defineFeature<SummaryRowsTypes>({
    name: "summaryRows",
    initial: (state, options) => {
        // the row bands and a size are the core's (D7), given by its options: counts that are not
        // whole numbers start without summary rows
        const given = {
            summaryRows:
                summaryRowCounts(options.summaryRows, NO_SUMMARY_ROWS) ??
                NO_SUMMARY_ROWS,
            summaryRowHeight:
                options.summaryRowHeight ?? state.summaryRowHeight,
        };
        return given;
    },
    commands: {
        "summary-rows.set": (state, payload) => {
            const counts = summaryRowCounts(payload, state.summaryRows);
            if (!counts) {
                return invalid(
                    "top and bottom must be whole numbers, 0 or more",
                );
            }
            // the active cell kept in the grid's new shape (on the same summary row, or the
            // nearest one left)
            const next =
                counts === state.summaryRows
                    ? state
                    : reconcile({ ...state, summaryRows: counts }, state);
            return done(next, next.summaryRows);
        },
        "summary-rows.changed": (state) => {
            const { top, bottom } = state.summaryRows;
            // no summary row: nothing to draw again
            const next =
                top + bottom > 0
                    ? { ...state, summaryRevision: state.summaryRevision + 1 }
                    : state;
            return done(next, next.summaryRevision);
        },
    },
    queries: {
        "summary-rows": (state) => state.summaryRows,
        "summary-row-height": (state) => state.summaryRowHeight,
        "summary-row-by": (state, { rowIndex }) =>
            summaryRowAt(state, rowIndex),
    },
    root: {
        props: ["summaryRows", "summaryRowHeight"],
        options: (props) => ({
            summaryRows: props.summaryRows,
            summaryRowHeight: props.summaryRowHeight,
        }),
        follow: (model) => [
            {
                // a count left out (the prop removed) is 0
                inputs: (props) => [
                    props.summaryRows?.top ?? 0,
                    props.summaryRows?.bottom ?? 0,
                ],
                run: (props) => {
                    const top = props.summaryRows?.top ?? 0;
                    const bottom = props.summaryRows?.bottom ?? 0;
                    const held = model.state.summaryRows;
                    if (top !== held.top || bottom !== held.bottom) {
                        model.run("summary-rows.set", { top, bottom });
                    }
                },
            },
            {
                // a prop removed goes back to the default; one that is no size is refused
                inputs: (props) => [props.summaryRowHeight],
                run: (props) => {
                    const height = props.summaryRowHeight ?? DEFAULT_ROW_HEIGHT;
                    if (height !== model.state.summaryRowHeight) {
                        model.run("sizes.set", { summaryRowHeight: height });
                    }
                },
            },
        ],
    },
});

/**
 * Summary rows (Epic #86, E2.1), as a feature (Epic #151): install it (`features:
 * [summaryRows()]`) for a grid to have rows of figures under its header and at its bottom edge
 * (`summaryRows`, `summaryRowHeight`; the adapters' `Summary` from their `/summary-rows`).
 */
export function summaryRows(): DataGridFeature<SummaryRowsTypes> {
    return SUMMARY_ROWS;
}
