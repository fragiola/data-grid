import {
    type AxisWindow,
    ariaRowIndex,
    type CellState,
    cellPart,
    type DataGridEngine,
    EMPTY_WINDOW,
    type EngineEventKey,
    type EngineLayer,
    type EngineQueryKey,
    type EngineQueryMap,
    measuredRow,
    type RowState,
    rowPart,
    rowTop,
    rowWidth,
    type SummaryCellState,
    summaryCellPart,
} from "@fragiola/data-grid";
import type * as React from "react";
import {
    type ReactNode,
    useContext,
    useMemo,
    useSyncExternalStore,
} from "react";
import {
    type CellInfo,
    HeaderRowContext,
    type HeaderRowInfo,
    type RowInfo,
    type SummaryCellInfo,
    useGrid,
    useRootGrid,
} from "../context";
import { cellPartProps } from "../utils/cell-part-props";
import { PINNED_KEYS } from "../utils/drop-keys";
import { layerRef } from "../utils/layer-ref";
import { rowStyle } from "../utils/row-style";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";
import { withTableSpans } from "../utils/with-table-spans";
import { type DataGridRef, noSubscription } from "./use-data-grid-ref";
import { useGridView } from "./use-grid-view";

/** What a part hook returns: its state, and the props for its element (the structural style in `props.style`). */
export interface PartHookResult<S> {
    state: S;
    props: Record<string, unknown> & { style: React.CSSProperties };
}

export function useWindow<TRow>(
    event: "row-window" | "column-window",
    gridRef: DataGridRef<TRow> | undefined,
): AxisWindow {
    const engine = useGrid(
        gridRef,
        "a window hook must be used inside <DataGrid.Root>, or be given a gridRef",
    )?.engine;
    return useEngineValue(engine, event, EMPTY_WINDOW);
}

/**
 * An engine's value it reports with an event of the same key (a window, the edit's draft): read
 * again when the event comes; `fallback` without an engine.
 */
export function useEngineValue<TRow, K extends EngineEventKey & EngineQueryKey>(
    engine: DataGridEngine<TRow, ReactNode> | undefined,
    key: K,
    fallback: EngineQueryMap[K],
): EngineQueryMap[K] {
    const subscribe = useMemo(
        () =>
            engine
                ? (listener: () => void) => engine.subscribe(key, listener)
                : noSubscription,
        [engine, key],
    );
    const read = () => (engine ? engine.get(key) : fallback);
    return useSyncExternalStore(subscribe, read, read);
}

/** `useRow`, its `ref` apart: a measured row's registration with the engine, else `undefined`. */
export function useRowPart<TRow>(
    row: RowInfo<TRow>,
): PartHookResult<RowState> & {
    ref: React.RefCallback<HTMLElement> | undefined;
} {
    const view = useGridView<TRow>();
    const { engine } = useRootGrid();
    // the row's kind, read once by `useRows`
    const { state, ariaSelected, ariaTree } = rowPart(
        view,
        row.rowIndex,
        row.loaded,
        row,
    );
    const measured = measuredRow(view, row.loaded);
    return {
        state,
        ref: measured ? layerRef(engine, "row") : undefined,
        props: {
            role: "row",
            "aria-rowindex": ariaRowIndex(view, row.rowIndex),
            ...(ariaSelected === undefined
                ? {}
                : { "aria-selected": ariaSelected }),
            // a treegrid's row (Epic #87): its level, expansion and set
            ...ariaTree,
            ...dataAttributes({
                "grid-part": "row",
                "row-index": row.rowIndex,
                loading: !row.loaded,
                active: state.active,
                expanded: state.expanded,
                selected: state.selected,
                // while a drag moves it, or would drop beside it (Epic #86)
                dragging: state.dragging,
                "drop-target": state.dropTarget ?? undefined,
                // its kind (Epic #87): a group row, a row group expanded, its depth
                "group-row": state.group !== undefined,
                "group-expanded": state.groupExpanded,
                depth: state.depth,
            }),
            // an expanded row's box holds its detail, below its cells
            style: rowStyle(
                view,
                rowTop(view, row.rowIndex),
                view.rowAxis.sizeOf(row.rowIndex),
                rowWidth(view, row.rowIndex),
                measured,
            ),
        },
    };
}

/** `useCell`, and how many columns the cell spans (a table cell's `colSpan`). */
export function useCellPart<TRow>(
    cell: CellInfo<TRow>,
): PartHookResult<CellState> & { columnSpan: number; measured: boolean } {
    const view = useGridView<TRow>();
    return cellPartProps(
        view,
        cellPart(view, cell),
        cell,
        undefined,
        measuredRow(view, cell.loaded),
    );
}

/**
 * A header row: the given one, else the one rendering (inside `DataGrid.HeaderRows` or
 * `DataGrid.HeaderRow`), else the last (a grid without groups has only that one).
 */
export function useHeaderRowOf<TRow>(
    row?: HeaderRowInfo<TRow>,
): HeaderRowInfo<TRow> | undefined {
    const view = useGridView<TRow>();
    // the header row that provides it was rendered for this grid's row type
    const rendering = useContext(
        HeaderRowContext,
    ) as HeaderRowInfo<TRow> | null;
    return row ?? rendering ?? view.headerRows[view.headerRows.length - 1];
}

/** `useSummaryCell`, and how many columns the cell spans (a table cell's `colSpan`). */
export function useSummaryCellPart<TRow>(
    cell: SummaryCellInfo<TRow>,
): PartHookResult<SummaryCellState> & {
    columnSpan: number;
    measured: boolean;
} {
    const view = useGridView<TRow>();
    return cellPartProps(
        view,
        summaryCellPart(view, cell),
        cell,
        view.summaryRowHeight,
    );
}

/** A ref that registers an element as one of the layers the engine of the `Root` around writes. */
export function useLayer(layer: EngineLayer): React.RefCallback<HTMLElement> {
    return layerRef(useRootGrid().engine, layer);
}

/**
 * A cell's element (a header cell's, a body or summary row cell's): its part's props with its
 * table spans, its content, and, pinned, the engine's inset (sticky, it stays in view sideways).
 */
export function useCellElement<State extends { readonly pinned: boolean }>(
    rest: DivPrimitiveProps<State>,
    own: {
        readonly state: State;
        readonly props: Record<string, unknown>;
    },
    content: ReactNode,
    columnSpan: number,
    /** in a measured row (Epic #86): placed by the grid, its insets dropped as a pinned cell's */
    measured: boolean,
    rowSpan?: number,
) {
    const { engine } = useRootGrid();
    return useRenderElement("div", rest, {
        state: own.state,
        props: withTableSpans(own.props, rest.render, columnSpan, rowSpan),
        children: content,
        ref: own.state.pinned ? layerRef(engine, "pinned") : undefined,
        drop: own.state.pinned || measured ? PINNED_KEYS : undefined,
    });
}
