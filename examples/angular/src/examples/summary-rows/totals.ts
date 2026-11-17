import type { SummaryPosition } from "@fragiola/data-grid-angular";
import { formatMoney, formatNumber, type Person } from "../_kit/data";

/** What the summary rows show: the app's own figures, over the rows it shows. */
export interface Totals {
    readonly count: number;
    readonly teams: number;
    readonly cities: number;
    readonly salary: number;
    readonly first: string;
    readonly last: string;
}

export function totalsOf(rows: readonly Person[]): Totals {
    const joined = rows.map((person) => person.joined).sort();
    return {
        count: rows.length,
        teams: new Set(rows.map((person) => person.team)).size,
        cities: new Set(rows.map((person) => person.city)).size,
        salary: rows.reduce((sum, person) => sum + person.salary, 0),
        first: joined[0] ?? "",
        last: joined[joined.length - 1] ?? "",
    };
}

/**
 * What each column's summary cells show, by key: the top row averages, the bottom row totals.
 * They change as the search does: the summary cells render them (the columns stay the same).
 * Text only, so a template interpolates it.
 */
export const SUMMARIES: Partial<
    Record<string, (totals: Totals, position: SummaryPosition) => string | null>
> = {
    name: (totals, position) =>
        position === "top"
            ? "Average"
            : `Total · ${formatNumber(totals.count)} people`,
    team: (totals, position) =>
        position === "bottom"
            ? `${totals.teams} teams in ${totals.cities} cities`
            : null,
    salary: (totals, position) =>
        totals.count === 0
            ? "—"
            : formatMoney(
                  position === "top"
                      ? Math.round(totals.salary / totals.count)
                      : totals.salary,
              ),
    joined: (totals, position) =>
        position === "bottom" && totals.count > 0
            ? `${totals.first.slice(0, 4)}–${totals.last.slice(0, 4)}`
            : null,
};
