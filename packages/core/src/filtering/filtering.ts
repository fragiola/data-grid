import type { HeaderCellState } from "../engine/parts";
import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeaturePartContribution,
    type FeatureState,
    type PartAttributes,
} from "../feature/feature";
import { sameFilters, withoutEmptyFilters } from "../model/filters";
import { done, fail } from "../model/result";
import type { HeaderCellLayout } from "../model/types";
import { filterableColumn, validColumnFilters } from "./filters";
import type {
    ColumnFilters,
    FilteringProps,
    FilteringState,
    FilteringTypes,
} from "./types";

// Filtering (Epic #153): the model keeps the column filters (`column-filters.set`,
// `column-filter.set`, `column-filters.clear`), the header cells of a filtered column carry
// `data-filtered`, and a root takes `columnFilters` / `defaultColumnFilters` /
// `onColumnFiltersChange`. The grid never filters the rows: the app does (`/local` in memory, a
// server otherwise), and the filter UIs are the app's.

/** The state as filtering reads it. */
type State = FeatureState<FilteringTypes>;

const NONE: ColumnFilters = Object.freeze({});

/** The filters a view shows (filtering installed: its `columnFilters`); none without it. */
export function columnFiltersOf(view: object): ColumnFilters {
    return (view as Partial<FilteringState>).columnFilters ?? NONE;
}

/** A header cell's filter as its part's state and attributes: `data-filtered` on a filtered column's. */
function headerCellPart(
    view: { readonly columnFilters: ColumnFilters },
    cell: HeaderCellLayout<unknown, unknown>,
): FeaturePartContribution<HeaderCellState> {
    const key = cell.column?.key;
    const filtered =
        key !== undefined && Object.hasOwn(view.columnFilters, key);
    return {
        state: { filtered },
        attributes: (filtered ? FILTERED : NO_ATTRIBUTES) as PartAttributes,
    };
}

const FILTERED = Object.freeze({ "data-filtered": "" });
const NO_ATTRIBUTES = Object.freeze({});

/**
 * The state with these filters (each key a column's, checked; the empty ones left out): the same
 * object when they are the ones it holds, and them.
 */
function withFilters(state: State, given: ColumnFilters) {
    if (given === null || typeof given !== "object" || Array.isArray(given)) {
        return fail("invalid_payload", "columnFilters must be an object");
    }
    for (const columnKey of Object.keys(given)) {
        const found = filterableColumn(state.columnEntries, columnKey);
        if (!found.ok) return found;
    }
    const columnFilters = withoutEmptyFilters(given);
    if (sameFilters(columnFilters, state.columnFilters)) {
        return done(state, state.columnFilters);
    }
    // the model's own copy: the caller's object changing later changes nothing
    const next = { ...state, columnFilters: { ...columnFilters } };
    return done(next, next.columnFilters);
}

/** The filtering feature's definition: every grid installing it shares it. */
const FILTERING = defineFeature<FilteringTypes>({
    name: "filtering",
    initial: (state, options) => ({
        columnFilters: {
            ...validColumnFilters(
                state.columnEntries,
                options.columnFilters ?? NONE,
            ),
        },
    }),
    commands: {
        "column-filters.set": (state, payload) =>
            withFilters(state, payload?.columnFilters),
        "column-filter.set": (state, { columnKey, value }) => {
            const found = filterableColumn(state.columnEntries, columnKey);
            if (!found.ok) return found;
            return withFilters(state, {
                ...state.columnFilters,
                [columnKey]: value,
            });
        },
        "column-filters.clear": (state, payload) => {
            const columnKey = payload?.columnKey;
            if (columnKey === undefined) return withFilters(state, NONE);
            const found = filterableColumn(state.columnEntries, columnKey);
            if (!found.ok) return found;
            const { [columnKey]: _, ...rest } = state.columnFilters;
            return withFilters(state, rest);
        },
    },
    queries: {
        "column-filters": (state) => state.columnFilters,
        "column-filter-by": (state, { columnKey }) =>
            Object.hasOwn(state.columnFilters, columnKey)
                ? state.columnFilters[columnKey]
                : undefined,
    },
    questions: {
        "column-filtered": (state, { columnKey }) =>
            Object.hasOwn(state.columnFilters, columnKey),
    },
    // a filtered column gone leaves the filters (one a collapsed group hides keeps its filter)
    sourceChanged: (after) => {
        const columnFilters = validColumnFilters(
            after.columnEntries,
            after.columnFilters,
        );
        return columnFilters === after.columnFilters
            ? after
            : { ...after, columnFilters };
    },
    view: ["columnFilters"],
    headerCell: headerCellPart,
    root: {
        props: [
            "columnFilters",
            "defaultColumnFilters",
            "onColumnFiltersChange",
        ],
        options: (props) => ({
            columnFilters: props.columnFilters ?? props.defaultColumnFilters,
        }),
        controlled: (model) => [
            defineControlled<FilteringProps, State, ColumnFilters>({
                prefix: "column-filter",
                prop: (props) => props.columnFilters,
                onChange: (props) => props.onColumnFiltersChange,
                // uncontrolled filters the columns could not take all of start without the rest:
                // the app is told the filters the grid holds
                start: (props) => props.defaultColumnFilters,
                read: (state) => state.columnFilters,
                same: sameFilters,
                // what the columns cannot take (a key that is no column's, an empty value) is
                // left out, and the parent told the filters as they settled
                apply: (value) => {
                    model.run("column-filters.set", {
                        columnFilters: validColumnFilters(
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
 * Filtering (`@fragiola/data-grid/filtering`): install it on a grid (`features: [filtering()]`)
 * for the model to keep the column filters. The grid keeps them; the app filters the rows
 * (`/local` in memory).
 */
export function filtering(): DataGridFeature<FilteringTypes> {
    return FILTERING;
}
