// @fragiola/data-grid-vue/local: rows in memory in one composable (Epic #47). An opt-in entry
// point: the primitives never import it, and an app that never imports it never ships it.

import type { ColumnOrGroup, RowKey } from "@fragiola/data-grid";
import {
    createLocalRows,
    type LocalRowsResult,
    localRowsResult,
    moveShownRowAt,
    plainRowKey,
    type UseLocalRowsOptions,
} from "@fragiola/data-grid/local";
import {
    computed,
    type MaybeRefOrGetter,
    onScopeDispose,
    shallowRef,
    toValue,
    type VNodeChild,
    watch,
} from "vue";

export {
    groupKeyOf,
    type LocalFilters,
    type LocalRowsOptions,
    type LocalRowsProps,
    type LocalRowsResult,
    type UseLocalRowsOptions,
} from "@fragiola/data-grid/local";

/** No grouping: the same list every time. */
const NO_GROUPS: readonly string[] = [];

const NO_KEYS: readonly RowKey[] = [];

/**
 * Rows in memory, sorted, filtered, searched, grouped and paged, in one composable: it keeps that
 * state itself. Bind `props` onto `DataGrid.Root` (`v-bind="local.props"`: its rows and its sort;
 * grouped, the rows shown, their kinds and the expanded groups), and give `filter`, `group` and
 * `page` to the app's own controls. Every field is read when used, so a template follows it.
 * `options` is where it starts (`pageSize`, `defaultSortColumns`, `defaultFilters`,
 * `defaultSearch`, `defaultPageIndex`, `defaultExpandedGroupKeys`; a new `pageSize` and a new
 * `groupBy` are followed); a filter, the search or the sort changing goes back to the first page.
 *
 * Keep `rows` and `columns` the same arrays while they do not change (each stage is computed
 * again when they do). Call it in `setup`.
 */
export function useLocalRows<TRow>(
    rows: MaybeRefOrGetter<readonly TRow[]>,
    columns: MaybeRefOrGetter<readonly ColumnOrGroup<TRow, VNodeChild>[]>,
    options?: MaybeRefOrGetter<UseLocalRowsOptions<TRow> | undefined>,
): LocalRowsResult<TRow> {
    const local = createLocalRows<TRow, VNodeChild>(toValue(options) ?? {});
    const state = shallowRef(local.state);
    onScopeDispose(
        local.subscribe(() => {
            state.value = local.state;
        }),
    );
    // `pageSize` is followed: a new one sets the page size (the first page)
    watch(
        () => toValue(options)?.pageSize,
        (pageSize) => local.setPageSize(pageSize),
    );
    // the expanded groups: controlled, the option's; else the pipeline's own, and the app told
    const setExpanded = (expandedGroupKeys: readonly RowKey[]) => {
        const given = toValue(options);
        if (given?.expandedGroupKeys === undefined) {
            local.setExpandedGroupKeys(expandedGroupKeys);
        }
        given?.onExpandedGroupKeysChange?.(expandedGroupKeys);
    };
    const expandedGroupKeys = computed(
        () =>
            toValue(options)?.expandedGroupKeys ??
            state.value.expandedGroupKeys,
    );
    const groupBy = computed(() => toValue(options)?.groupBy ?? NO_GROUPS);
    // stage by stage, computed again only when its own inputs change
    const view = computed(() => {
        // the pipeline's state: a new sort, filter or page derives again
        state.value;
        const given = toValue(options);
        return local.derive(toValue(rows), toValue(columns), {
            groupBy: groupBy.value,
            aggregates: given?.aggregates,
            rowKey: given?.rowKey,
            getSubRows: given?.getSubRows,
            isRowSelectable: given?.isRowSelectable,
            expandedGroupKeys: expandedGroupKeys.value,
        });
    });
    const rowKey = computed(() =>
        plainRowKey(toValue(options)?.rowKey, view.value),
    );
    // a page past the last (the rows shrank) showed the last one: once on screen, it is the page,
    // so rows growing back stay there
    watch(
        () => view.value.pageIndex,
        (pageIndex) => {
            if (pageIndex !== local.state.pageIndex)
                local.setPageIndex(pageIndex);
        },
        { immediate: true, flush: "post" },
    );
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
        const given = toValue(rows);
        const shown = view.value;
        const current =
            moved && moved.from[0] === given && moved.from[1] === shown
                ? moved
                : { rows: given, rowIndexes: shown.rowIndexes };
        // a tree's rows are not one list: nothing moves
        if (toValue(options)?.getSubRows) return current.rows;
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
        view.value.groups?.subRowKeysOf(rowIndex) ?? NO_KEYS;
    const result = computed(() =>
        localRowsResult({
            local,
            state: state.value,
            view: view.value,
            expandedGroupKeys: expandedGroupKeys.value,
            groupBy: groupBy.value,
            rowKey: rowKey.value,
            setExpanded,
            subRowKeysOf,
            moveRow,
        }),
    );
    // every field read when used: a template (or a computed) reading one follows it
    return {
        get props() {
            return result.value.props;
        },
        get rows() {
            return result.value.rows;
        },
        get total() {
            return result.value.total;
        },
        get filteredCount() {
            return result.value.filteredCount;
        },
        get filteredRows() {
            return result.value.filteredRows;
        },
        get group() {
            return result.value.group;
        },
        get sort() {
            return result.value.sort;
        },
        get filter() {
            return result.value.filter;
        },
        moveRow,
        get page() {
            return result.value.page;
        },
    };
}
