import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeatureState,
} from "../feature/feature";
import { done, fail } from "../model/result";
import { rowCountOf } from "../model/source";
import type { CommandFailure } from "../model/types";
import type { PageInfo, PaginationProps, PaginationTypes } from "./types";

// Pagination (Epic #153): the model keeps the page and its size (`page.set`, `page-size.set`) and
// the rows across every page (`total-row-count.set`, a root's `totalRowCount`), so `get("page-info")`
// and `get("page-count")` count the pages; a root takes `pageIndex` / `defaultPageIndex` /
// `onPageIndexChange` and `pageSize` / `defaultPageSize` / `onPageSizeChange`. The grid never
// pages the rows: the app does (`/local` in memory, a server otherwise), and the pager is the
// app's. The first-page rules (a filter changing goes back to it) are the app's and `/local`'s:
// the model's pieces never move each other.

/** The state as pagination reads it. */
type State = FeatureState<PaginationTypes>;

/** How many pages `count` rows make: one at least; one in all without a page size. */
export function pageCount(count: number, pageSize: number | undefined): number {
    if (pageSize === undefined || !(pageSize > 0)) return 1;
    return Math.max(1, Math.ceil(count / pageSize));
}

/** A page index: a whole number, 0 or more, or `null` for anything else. */
function validPageIndex(pageIndex: unknown): number | null {
    return typeof pageIndex === "number" &&
        Number.isInteger(pageIndex) &&
        pageIndex >= 0
        ? pageIndex
        : null;
}

/** A page size: a whole number above 0, `undefined` (none), or `null` for anything else. */
function validPageSize(pageSize: unknown): number | undefined | null {
    if (pageSize === undefined) return undefined;
    return typeof pageSize === "number" &&
        Number.isInteger(pageSize) &&
        pageSize >= 1
        ? pageSize
        : null;
}

/** A row count: a whole number, 0 or more, `undefined` (the grid's own), or `null` for anything else. */
function validRowCount(count: unknown): number | undefined | null {
    if (count === undefined) return undefined;
    return validPageIndex(count);
}

function invalid(message: string): CommandFailure {
    return fail("invalid_payload", message);
}

/** The rows the pages are counted from: the total given, else the grid's own. */
function rowCountIn(state: State): number {
    return state.totalRowCount ?? rowCountOf(state.source);
}

/** The pages there are in a state. */
function pagesIn(state: State): number {
    return pageCount(rowCountIn(state), state.pageSize);
}

/** The state with one of its fields set: the same object when it holds that value. */
function withField<K extends "pageIndex" | "pageSize" | "totalRowCount">(
    state: State,
    key: K,
    value: State[K],
) {
    const next = Object.is(state[key], value)
        ? state
        : { ...state, [key]: value };
    return done(next, next[key]);
}

/** A whole page index from an option (anything else: the first page). */
function startIndex(pageIndex: number | undefined): number {
    return validPageIndex(pageIndex) ?? 0;
}

/** The pagination feature's definition: every grid installing it shares it. */
const PAGINATION = defineFeature<PaginationTypes>({
    name: "pagination",
    initial: (_, options) => ({
        pageIndex: startIndex(options.pageIndex),
        pageSize: validPageSize(options.pageSize) ?? undefined,
        totalRowCount: validRowCount(options.totalRowCount) ?? undefined,
    }),
    commands: {
        "page.set": (state, payload) => {
            const pageIndex = validPageIndex(payload?.pageIndex);
            if (pageIndex === null) {
                return invalid("pageIndex must be a whole number, 0 or more");
            }
            return withField(state, "pageIndex", pageIndex);
        },
        "page-size.set": (state, payload) => {
            const pageSize = validPageSize(payload?.pageSize);
            if (pageSize === null) {
                return invalid("pageSize must be a whole number above 0");
            }
            return withField(state, "pageSize", pageSize);
        },
        "total-row-count.set": (state, payload) => {
            const totalRowCount = validRowCount(payload?.totalRowCount);
            if (totalRowCount === null) {
                return invalid(
                    "totalRowCount must be a whole number, 0 or more",
                );
            }
            return withField(state, "totalRowCount", totalRowCount);
        },
    },
    queries: {
        "page-info": (state): PageInfo => ({
            pageIndex: state.pageIndex,
            pageSize: state.pageSize,
            pageCount: pagesIn(state),
            rowCount: rowCountIn(state),
        }),
        "page-count": pagesIn,
    },
    questions: {
        "page-previous": (state) => state.pageIndex > 0,
        "page-next": (state) => state.pageIndex < pagesIn(state) - 1,
    },
    root: {
        props: [
            "pageIndex",
            "defaultPageIndex",
            "onPageIndexChange",
            "pageSize",
            "defaultPageSize",
            "onPageSizeChange",
            "totalRowCount",
        ],
        options: (props) => ({
            pageIndex: props.pageIndex ?? props.defaultPageIndex,
            pageSize:
                props.pageSize === null
                    ? undefined
                    : (props.pageSize ?? props.defaultPageSize),
            totalRowCount: props.totalRowCount,
        }),
        controlled: (model) => [
            defineControlled<PaginationProps, State, number>({
                prefix: "page.",
                prop: (props) => props.pageIndex,
                onChange: (props) => props.onPageIndexChange,
                start: (props) => props.defaultPageIndex,
                read: (state) => state.pageIndex,
                same: Object.is,
                // a page that is no whole number is the first
                apply: (value) => {
                    model.run("page.set", { pageIndex: startIndex(value) });
                },
            }),
            // controlled as `null` (no page size) or a size; uncontrolled while `undefined`
            defineControlled<PaginationProps, State, number | null>({
                prefix: "page-size.",
                prop: (props) => props.pageSize,
                onChange: (props) => {
                    const onChange = props.onPageSizeChange;
                    return (
                        onChange && ((value) => onChange(value ?? undefined))
                    );
                },
                read: (state) => state.pageSize ?? null,
                same: Object.is,
                fromCommand: (_, value) =>
                    (value as number | undefined) ?? null,
                // a size that is no whole number above 0 is none
                apply: (value) => {
                    model.run("page-size.set", {
                        pageSize:
                            validPageSize(value ?? undefined) ?? undefined,
                    });
                },
            }),
        ],
        follow: (model) => [
            {
                // a prop removed goes back to the grid's own row count
                inputs: (props) => [props.totalRowCount],
                run: (props) => {
                    const totalRowCount =
                        validRowCount(props.totalRowCount) ?? undefined;
                    if (totalRowCount !== model.state.totalRowCount) {
                        model.run("total-row-count.set", { totalRowCount });
                    }
                },
            },
        ],
    },
});

/**
 * Pagination (`@fragiola/data-grid/pagination`): install it on a grid (`features:
 * [pagination()]`) for the model to keep the page and its size. The grid keeps them; the app
 * pages the rows (`/local` in memory).
 */
export function pagination(): DataGridFeature<PaginationTypes> {
    return PAGINATION;
}
