import type { HeaderCellState } from "../engine/parts";
import type { GridView } from "../engine/types";
import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeatureEngineContext,
    type FeaturePartContribution,
    type FeatureState,
    type PartAttributes,
} from "../feature/feature";
import { done, fail } from "../model/result";
import type { CommandFailure, HeaderCellLayout } from "../model/types";
import {
    SORT_DIRECTIONS,
    sameSortColumns,
    sortableColumn,
    toggledSort,
    validSortColumns,
} from "./sort";
import type {
    SortColumn,
    SortDirection,
    SortingProps,
    SortingState,
    SortingTypes,
} from "./types";

// Sorting (Epic #27, S1–S7), the first feature (Epic #141): the model keeps `sortColumns`
// (`sort-columns.set`, `sort-columns.toggle`), a click, Enter or Space on a sortable column's
// header cell toggles it (Ctrl/⌘ adds it), the header cells carry `aria-sort`, `data-sortable`,
// `data-sort` and `data-sort-priority`, and a root takes `sortColumns` / `defaultSortColumns` /
// `onSortColumnsChange`. The grid never orders the rows: the app does.

/** The state as sorting reads it. */
type State = FeatureState<SortingTypes>;

/** A header cell's sort, as the adapters show it (S6). */
export interface HeaderCellSort {
    /** its column sorts the grid (never a group) */
    readonly sortable: boolean;
    /** the direction its column is sorted in, when it is */
    readonly direction: SortDirection | undefined;
    /** its column's place among the sorted columns, 1-based, when it is sorted */
    readonly priority: number | undefined;
    /**
     * `aria-sort`, on the first sorted column with a header cell of its own (ARIA 1.2: one header
     * at a time; a column a collapsed group hides or a header span covers holds none, and may
     * hold priority 1)
     */
    readonly ariaSort: SortDirection | undefined;
}

/** How a header cell shows the sort: sortable, and its direction and priority when sorted. */
export function headerCellSort<TRow, TNode>(
    view: Pick<GridView<TRow, TNode>, "header"> & {
        readonly sortColumns: readonly SortColumn[];
    },
    cell: HeaderCellLayout<TRow, TNode>,
): HeaderCellSort {
    const column = cell.column;
    const index = column
        ? view.sortColumns.findIndex((entry) => entry.columnKey === column.key)
        : -1;
    const sorted = view.sortColumns[index];
    // `aria-sort` on the first sorted column with a header cell of its own: one a collapsed
    // group hides (E1.3) or a header span covers (E1.2) still sorts, and keeps its priority
    const first =
        sorted &&
        view.sortColumns.find((entry) => {
            const own = view.header.cellByKey(entry.columnKey);
            return (
                own !== undefined &&
                view.header.cellAt(own.rowIndex, own.columnIndex) === own
            );
        });
    return {
        sortable: column?.sortable === true,
        direction: sorted?.direction,
        priority: sorted ? index + 1 : undefined,
        ariaSort: first === sorted ? sorted?.direction : undefined,
    };
}

/** No sort: what a view without sorting installed holds. */
const UNSORTED: readonly SortColumn[] = [];

/**
 * The sort a view shows (sorting installed: its `sortColumns`, on the view by name), the first
 * column first; none without sorting. For what an app renders from the whole sort (a count, a
 * label), the view's own (a new view per sort).
 */
export function sortColumnsOf(view: object): readonly SortColumn[] {
    return (view as Partial<SortingState>).sortColumns ?? UNSORTED;
}

/** A header cell's sort as its part's state and attributes. */
function headerCellPart(
    view: Pick<GridView<unknown, unknown>, "header"> & {
        readonly sortColumns: readonly SortColumn[];
    },
    cell: HeaderCellLayout<unknown, unknown>,
): FeaturePartContribution<HeaderCellState> {
    const sort = headerCellSort(view, cell);
    const attributes: Record<string, string> = {};
    if (sort.ariaSort) attributes["aria-sort"] = sort.ariaSort;
    if (sort.sortable) attributes["data-sortable"] = "";
    if (sort.direction) attributes["data-sort"] = sort.direction;
    if (sort.priority !== undefined) {
        attributes["data-sort-priority"] = String(sort.priority);
    }
    return {
        state: {
            sortable: sort.sortable,
            sortDirection: sort.direction,
            sortPriority: sort.priority,
        },
        attributes: attributes as PartAttributes,
    };
}

/** The refusal of a payload that is not what the command takes. */
function invalid(message: string): CommandFailure {
    return fail("invalid_payload", message);
}

/** The model's own copy of a sort: the caller's array changing later changes nothing. */
function copied(sortColumns: readonly SortColumn[]): readonly SortColumn[] {
    return sortColumns.map(({ columnKey, direction }) => ({
        columnKey,
        direction,
    }));
}

/**
 * The state with the sort (the same object when it is the same, else it as `kept` keeps it), and
 * it.
 */
function withSort(
    state: State,
    sortColumns: readonly SortColumn[],
    kept: (sortColumns: readonly SortColumn[]) => readonly SortColumn[] = (
        given,
    ) => given,
) {
    const next = sameSortColumns(sortColumns, state.sortColumns)
        ? state
        : { ...state, sortColumns: kept(sortColumns) };
    return done(next, next.sortColumns);
}

/**
 * The sortable column whose header cell an event happened in, or `null`: not a header cell, a
 * group, or a column that is not sortable.
 */
function sortableColumnOf(
    context: FeatureEngineContext<SortingTypes>,
    target: EventTarget | null,
): string | null {
    const column = context.headerCellOf(target)?.column;
    return column?.sortable === true ? column.key : null;
}

/** The sorting feature's definition: every grid installing it shares it. */
const SORTING = defineFeature<SortingTypes>({
    name: "sorting",
    initial: (state, options) => ({
        sortColumns: copied(
            validSortColumns(state.columnEntries, options.sortColumns ?? []),
        ),
    }),
    commands: {
        "sort-columns.set": (state, { sortColumns }) => {
            if (!Array.isArray(sortColumns)) {
                return invalid("sortColumns must be an array");
            }
            const seen = new Set<string>();
            for (const entry of sortColumns) {
                if (!SORT_DIRECTIONS.includes(entry?.direction)) {
                    return invalid(
                        `direction must be one of ${SORT_DIRECTIONS.join(", ")}`,
                    );
                }
                const found = sortableColumn(
                    state.columnEntries,
                    entry.columnKey,
                );
                if (!found.ok) return found;
                if (seen.has(entry.columnKey)) {
                    return invalid(
                        `column "${entry.columnKey}" is sorted twice`,
                    );
                }
                seen.add(entry.columnKey);
            }
            return withSort(state, sortColumns, copied);
        },
        "sort-columns.toggle": (state, { columnKey, multi }) => {
            const found = sortableColumn(state.columnEntries, columnKey);
            if (!found.ok) return found;
            return withSort(
                state,
                toggledSort(state.sortColumns, columnKey, multi === true),
            );
        },
    },
    queries: {
        "sort-columns": (state) => state.sortColumns,
        "sort-column-by": (state, { columnKey }) =>
            state.sortColumns.find((entry) => entry.columnKey === columnKey),
    },
    questions: {
        "column-sortable": (state, { columnKey }) =>
            sortableColumn(state.columnEntries, columnKey).ok,
    },
    // a sorted column gone, or no longer sortable, leaves the sort (one a collapsed group hides
    // keeps it)
    sourceChanged: (after) => {
        const sortColumns = validSortColumns(
            after.columnEntries,
            after.sortColumns,
        );
        return sortColumns === after.sortColumns
            ? after
            : { ...after, sortColumns };
    },
    view: ["sortColumns"],
    // sorted, the app orders the rows its own way: a row move would not stay where it was dropped
    rowsOrdered: (state) => state.sortColumns.length > 0,
    headerCell: headerCellPart,
    engine: (context) => ({
        // Enter or Space on a sortable column's header cell toggles its sort, once per press: a
        // key held down repeats, and would cycle through the sort
        keydown: (event, target) => {
            if (
                (event.key !== "Enter" && event.key !== " ") ||
                event.shiftKey
            ) {
                return false;
            }
            const columnKey = sortableColumnOf(context, target);
            if (columnKey === null) return false;
            event.preventDefault();
            if (!event.repeat) {
                context.model.run("sort-columns.toggle", {
                    columnKey,
                    multi: event.ctrlKey || event.metaKey,
                });
            }
            return true;
        },
        // a click on a sortable column's header cell toggles it (Ctrl/⌘ adds it); with Shift or
        // Alt it is no sort
        click: (event) => {
            if (event.altKey || event.shiftKey) return false;
            const columnKey = sortableColumnOf(context, event.target);
            if (columnKey === null) return false;
            context.model.run("sort-columns.toggle", {
                columnKey,
                multi: event.ctrlKey || event.metaKey,
            });
            return true;
        },
    }),
    root: {
        props: ["sortColumns", "defaultSortColumns", "onSortColumnsChange"],
        options: (props) => ({
            sortColumns: props.sortColumns ?? props.defaultSortColumns,
        }),
        controlled: (model) => [
            defineControlled<
                SortingProps,
                FeatureState<SortingTypes>,
                readonly SortColumn[]
            >({
                prefix: "sort-columns.",
                prop: (props) => props.sortColumns,
                onChange: (props) => props.onSortColumnsChange,
                // an uncontrolled sort the columns could not take all of (a column not sortable)
                // starts without it: the app is told the sort the grid holds
                start: (props) => props.defaultSortColumns,
                read: (state) => state.sortColumns,
                same: sameSortColumns,
                // what the columns cannot take (a column not sortable, twice) is left out, as at
                // mount, and the parent is told the sort as it settled
                apply: (value) => {
                    model.run("sort-columns.set", {
                        sortColumns: validSortColumns(
                            model.state.columnEntries,
                            value,
                        ),
                    });
                },
            }),
        ],
    },
});

/**
 * Sorting (`@fragiola/data-grid/sorting`): install it on a grid (`features: [sorting()]`) for
 * its header cells to sort. The grid keeps the sort; the app orders the rows.
 */
export function sorting(): DataGridFeature<SortingTypes> {
    return SORTING;
}
