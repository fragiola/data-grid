// @fragiola/data-grid-react/local: rows in memory in one hook (Epic #47). An opt-in entry point:
// the primitives never import it, and an app that never imports it never ships it.

import type { DataGridFeatures, RowKey } from "@fragiola/data-grid";
import {
    createLocalRows,
    type LocalRowsResult,
    localRowsResult,
    localStagesOf,
    moveShownRowAt,
    plainRowKey,
    type UseLocalRowsOptions,
} from "@fragiola/data-grid/local";
import {
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import type { ColumnOrGroup } from "../context";

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

/** No grouping: the same list every render. */
const NO_GROUPS: readonly string[] = [];

const NO_KEYS: readonly RowKey[] = [];

/** No features: no stage, no feature's props. */
const NO_FEATURES: DataGridFeatures = [];

/**
 * Rows in memory, sorted, filtered, searched, grouped and paged, in one hook, by the features the
 * grid installs (Epic #153: `options.features`, the same list as `Root`'s): each of `sorting()`,
 * `filtering()`, `search()` and `pagination()` runs its stage, one not installed is skipped.
 * Spread `props` onto `DataGrid.Root` (its rows and the state of those features, which the root's
 * model holds, controlled by this hook: a command run on the model comes back here; grouped, the
 * rows shown, their kinds and, with `rowGrouping()`, the expanded groups), and give `filter`,
 * `group` and `page` to the app's own controls. `options` is where it starts (`pageSize`,
 * `defaultSortColumns`, `defaultFilters`, `defaultSearch`, `defaultPageIndex`,
 * `defaultExpandedGroupKeys`; a new `pageSize` and a new `groupBy` are followed); a filter, the
 * search or the sort changing goes back to the first page.
 * Grouped (`groupBy`, Epic #87), the sort and the filters apply inside the groups, the groups are
 * ordered by the sort when it sorts their column (else ascending), and a page is of the rows shown,
 * group rows included.
 *
 * Keep `rows` and `columns` the same arrays between renders (outside the component, or memoised),
 * as `DataGrid.Root` wants its `columns`: each stage is computed again when they change.
 */
export function useLocalRows<
    TRow,
    const TFeatures extends DataGridFeatures = [],
>(
    rows: readonly TRow[],
    columns: readonly ColumnOrGroup<TRow>[],
    options?: UseLocalRowsOptions<TRow, TFeatures>,
): LocalRowsResult<TRow, TFeatures> {
    // the features are the grid's from its creation: read once, as the root reads its own
    const [features] = useState(
        (): DataGridFeatures => options?.features ?? NO_FEATURES,
    );
    const [local] = useState(() =>
        createLocalRows<TRow, ReactNode>({
            ...options,
            stages: localStagesOf(features),
        }),
    );
    // `pageSize` is followed: a new one sets the page size (the first page)
    const pageSize = options?.pageSize;
    const appliedPageSize = useRef(pageSize);
    useEffect(() => {
        if (Object.is(appliedPageSize.current, pageSize)) return;
        appliedPageSize.current = pageSize;
        local.setPageSize(pageSize);
    }, [local, pageSize]);
    const state = useSyncExternalStore(
        local.subscribe,
        () => local.state,
        () => local.state,
    );
    // the expanded groups: controlled, the option's; else the pipeline's own, and the app told
    // the latest options, as of the last commit (a discarded render writes nothing)
    const latestOptions = useRef(options);
    useLayoutEffect(() => {
        latestOptions.current = options;
    });
    const [setExpanded] = useState(
        () => (expandedGroupKeys: readonly RowKey[]) => {
            const given = latestOptions.current;
            if (given?.expandedGroupKeys === undefined) {
                local.setExpandedGroupKeys(expandedGroupKeys);
            }
            given?.onExpandedGroupKeysChange?.(expandedGroupKeys);
        },
    );
    const expandedGroupKeys =
        options?.expandedGroupKeys ?? state.expandedGroupKeys;
    const groupBy = options?.groupBy ?? NO_GROUPS;
    // stage by stage, computed again only when its own inputs change: cheap on every render
    const view = local.derive(rows, columns, {
        groupBy,
        aggregates: options?.aggregates,
        rowKey: options?.rowKey,
        getSubRows: options?.getSubRows,
        isRowSelectable: options?.isRowSelectable,
        expandedGroupKeys,
    });
    // not grouped, the app's key with the index it takes (its row's among the rows given): the
    // same keys whether the rows are grouped or not
    const rowKey = options?.rowKey;
    const plainKey = useMemo(() => plainRowKey(rowKey, view), [rowKey, view]);
    // a page past the last (the rows shrank) showed the last one: once on screen, it is the page,
    // so rows growing back stay there (written after the commit: a discarded render writes nothing)
    useEffect(() => {
        if (view.pageIndex !== state.pageIndex)
            local.setPageIndex(view.pageIndex);
    }, [local, view.pageIndex, state.pageIndex]);
    // the rows and where the rows shown are among them, as of the last commit or as the last
    // move left them: a next move before a render is one on screen after this one
    const moved = useRef<{
        rows: readonly TRow[];
        view: { readonly rowIndexes: readonly number[] };
    }>({ rows, view });
    useLayoutEffect(() => {
        moved.current = { rows, view };
    });
    const [moveRow] = useState(
        () =>
            ({
                fromIndex,
                toIndex,
            }: {
                fromIndex: number;
                toIndex: number;
            }) => {
                const { rows: given, view: shown } = moved.current;
                // a tree's rows are not one list: nothing moves (the grid moves no row while its
                // rows have kinds)
                if (latestOptions.current?.getSubRows) return given;
                const next = moveShownRowAt(
                    given,
                    shown.rowIndexes,
                    fromIndex,
                    toIndex,
                );
                if (!next) return given;
                // where the rows shown are now: each one where the move put it, in their new order
                moved.current = {
                    rows: next.rows,
                    view: { rowIndexes: next.rowIndexes },
                };
                return next.rows;
            },
    );
    const { groups } = view;
    // the same function while the rows shown are (a parent's keys are worked out once per tree)
    const subRowKeysOf = useCallback(
        (rowIndex: number) => groups?.subRowKeysOf(rowIndex) ?? NO_KEYS,
        [groups],
    );
    return localRowsResult<TRow, TFeatures>({
        local,
        features,
        state,
        view,
        expandedGroupKeys,
        groupBy,
        rowKey: plainKey,
        setExpanded,
        subRowKeysOf,
        moveRow,
    });
}
