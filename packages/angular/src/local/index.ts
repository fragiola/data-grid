// @fragiola/data-grid-angular/local: rows in memory in one injection function (Epic #47). An
// opt-in entry point: the directives never import it, and an app that never imports it never
// ships it.

import {
    computed,
    DestroyRef,
    Directive,
    effect,
    inject,
    input,
    isSignal,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import type {
    ColumnOrGroup,
    DataGridFeatures,
    RowKey,
} from "@fragiola/data-grid";
import {
    createLocalRows,
    type LocalRowsResult,
    localRowsResult,
    localStagesOf,
    moveShownRowAt,
    plainRowKey,
    type UseLocalRowsOptions,
} from "@fragiola/data-grid/local";
import { type DataGridNode, DataGridRoot } from "@fragiola/data-grid-angular";

export {
    groupKeyOf,
    type LocalFeatureProps,
    type LocalFilters,
    type LocalGroupProps,
    type LocalRowsOptions,
    type LocalRowsProps,
    type LocalRowsResult,
    type UseLocalRowsOptions,
} from "@fragiola/data-grid/local";

/** A value `injectLocalRows` takes: a signal (an input), a getter, or the value itself. */
type ValueOrSignal<T> = T | Signal<T> | (() => T);

const valueNow = <T>(value: ValueOrSignal<T>): T =>
    isSignal(value) || typeof value === "function"
        ? (value as () => T)()
        : value;

/** No grouping: the same list every time. */
const NO_GROUPS: readonly string[] = [];

const NO_KEYS: readonly RowKey[] = [];

/** No features: no stage, no feature's props. */
const NO_FEATURES: DataGridFeatures = [];

/**
 * Rows in memory, sorted, filtered, searched, grouped and paged, in one injection function, by
 * the features the grid installs (React's `useLocalRows`; Epic #153: `options.features`, the same
 * list as the root's, read once): each of `sorting()`, `filtering()`, `search()` and
 * `pagination()` runs its stage, one not installed is skipped. Give it to the root (`<div
 * dataGridRoot [features]="features" [dataGridLocalRows]="local" [columns]="columns">`: its rows
 * and the state of those features, which the root's model holds, controlled by it: a command run
 * on the model comes back here; grouped, the rows shown, their kinds and, with `rowGrouping()`,
 * the expanded groups), and `filter`, `group` and `page` to the app's own controls. Every field is read when used, so a template (or a computed) follows
 * it. `options` is where it starts (`pageSize`, `defaultSortColumns`, `defaultFilters`,
 * `defaultSearch`, `defaultPageIndex`, `defaultExpandedGroupKeys`; a new `pageSize` and a new
 * `groupBy` are followed); a filter, the search or the sort changing goes back to the first page.
 *
 * Keep `rows` and `columns` the same arrays while they do not change (each stage is computed
 * again when they do). Call it in an injection context (a constructor, a field).
 */
export function injectLocalRows<
    TRow,
    const TFeatures extends DataGridFeatures = [],
>(
    rows: ValueOrSignal<readonly TRow[]>,
    columns: ValueOrSignal<readonly ColumnOrGroup<TRow, DataGridNode>[]>,
    options?: ValueOrSignal<UseLocalRowsOptions<TRow, TFeatures> | undefined>,
): LocalRowsResult<TRow, TFeatures> {
    const optionsNow = () =>
        options === undefined ? undefined : valueNow(options);
    const initial = untracked(optionsNow);
    // the features are the grid's from its creation: read once, as the root reads its own
    const features: DataGridFeatures = initial?.features ?? NO_FEATURES;
    const local = createLocalRows<TRow, DataGridNode>({
        ...initial,
        stages: localStagesOf(features),
    });
    const state = signal(local.state);
    inject(DestroyRef).onDestroy(
        local.subscribe(() => {
            state.set(local.state);
        }),
    );
    // `pageSize` is followed: a new one sets the page size (the first page)
    let pageSize = untracked(optionsNow)?.pageSize;
    effect(() => {
        const next = optionsNow()?.pageSize;
        if (next === pageSize) return;
        pageSize = next;
        untracked(() => local.setPageSize(next));
    });
    // the expanded groups: controlled, the option's; else the pipeline's own, and the app told
    const setExpanded = (expandedGroupKeys: readonly RowKey[]) => {
        const given = optionsNow();
        if (given?.expandedGroupKeys === undefined) {
            local.setExpandedGroupKeys(expandedGroupKeys);
        }
        given?.onExpandedGroupKeysChange?.(expandedGroupKeys);
    };
    const expandedGroupKeys = computed(
        () => optionsNow()?.expandedGroupKeys ?? state().expandedGroupKeys,
    );
    const groupBy = computed(() => optionsNow()?.groupBy ?? NO_GROUPS);
    // stage by stage, computed again only when its own inputs change
    const view = computed(() => {
        // the pipeline's state: a new sort, filter or page derives again
        state();
        const given = optionsNow();
        return local.derive(valueNow(rows), valueNow(columns), {
            groupBy: groupBy(),
            aggregates: given?.aggregates,
            rowKey: given?.rowKey,
            getSubRows: given?.getSubRows,
            isRowSelectable: given?.isRowSelectable,
            expandedGroupKeys: expandedGroupKeys(),
        });
    });
    const rowKey = computed(() => plainRowKey(optionsNow()?.rowKey, view()));
    // a page past the last (the rows shrank) showed the last one: once on screen, it is the page,
    // so rows growing back stay there
    effect(() => {
        const { pageIndex } = view();
        untracked(() => {
            if (pageIndex !== local.state.pageIndex) {
                local.setPageIndex(pageIndex);
            }
        });
    });
    // the rows as the last move left them, while the rows and the view it moved from stand: a
    // next move before they change is one on screen after this one
    let moved: {
        readonly from: readonly [readonly TRow[], unknown];
        readonly rows: readonly TRow[];
        readonly rowIndexes: readonly number[];
    } | null = null;
    const moveRow = ({
        fromIndex,
        toIndex,
    }: {
        readonly fromIndex: number;
        readonly toIndex: number;
    }): readonly TRow[] => {
        const given = untracked(() => valueNow(rows));
        const shown = untracked(view);
        const current =
            moved && moved.from[0] === given && moved.from[1] === shown
                ? moved
                : { rows: given, rowIndexes: shown.rowIndexes };
        // a tree's rows are not one list: nothing moves
        if (untracked(optionsNow)?.getSubRows) return current.rows;
        const next = moveShownRowAt(
            current.rows,
            current.rowIndexes,
            fromIndex,
            toIndex,
        );
        if (!next) return current.rows;
        moved = { from: [given, shown], ...next };
        return next.rows;
    };
    const subRowKeysOf = (rowIndex: number) =>
        untracked(view).groups?.subRowKeysOf(rowIndex) ?? NO_KEYS;
    const result = computed(() =>
        localRowsResult<TRow, TFeatures>({
            local,
            features,
            state: state(),
            view: view(),
            expandedGroupKeys: expandedGroupKeys(),
            groupBy: groupBy(),
            rowKey: rowKey(),
            setExpanded,
            subRowKeysOf,
            moveRow,
        }),
    );
    // every field read when used: a template (or a computed) reading one follows it
    return {
        get props() {
            return result().props;
        },
        get rows() {
            return result().rows;
        },
        get total() {
            return result().total;
        },
        get filteredCount() {
            return result().filteredCount;
        },
        get filteredRows() {
            return result().filteredRows;
        },
        get group() {
            return result().group;
        },
        get sort() {
            return result().sort;
        },
        get filter() {
            return result().filter;
        },
        moveRow,
        get page() {
            return result().page;
        },
    };
}

/**
 * Gives a root the props of `injectLocalRows` (React's `{...local.props}` on `Root`): its rows and
 * the state of the features it runs (the sort, the filters, the search, the page), grouped the
 * rows shown, their kinds and the expanded groups, over the root's own inputs. On the root's element: `<div dataGridRoot [dataGridLocalRows]="local"
 * [columns]="columns">`.
 */
@Directive({ selector: "[dataGridRoot][dataGridLocalRows]" })
export class DataGridLocalRows<TRow = unknown> {
    /** what `injectLocalRows` returned */
    readonly dataGridLocalRows =
        input.required<LocalRowsResult<TRow, DataGridFeatures>>();

    constructor() {
        const root = inject<DataGridRoot<TRow>>(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource(() => this.dataGridLocalRows().props),
        );
    }
}
