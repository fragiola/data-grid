import type { SummaryPosition } from "@fragiola/data-grid-vue";
import { formatMoney } from "../_kit/data";

/** The figures the summary rows show, over every job. */
export interface Totals {
    readonly count: number;
    readonly budget: number;
    readonly available: number;
}

/**
 * What each column's summary cells show, by key: the top row the averages, the bottom the totals
 * (text: a template interpolates it)
 */
export const SUMMARIES: Partial<
    Record<string, (totals: Totals, position: SummaryPosition) => string>
> = {
    name: (totals, position) =>
        position === "top" ? "Average" : `Total · ${totals.count} jobs`,
    budget: (totals, position) =>
        formatMoney(
            position === "top"
                ? Math.round(totals.budget / Math.max(1, totals.count))
                : totals.budget,
        ),
    available: (totals) =>
        `${((100 * totals.available) / Math.max(1, totals.count)).toFixed(1)}%`,
};
