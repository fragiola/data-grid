import {
    type AxisWindow,
    type CellState,
    cellPartOf,
    type DataGridEngine,
    EMPTY_WINDOW,
    type EngineEventKey,
    type EngineLayer,
    type EngineQueryKey,
    type EngineQueryMap,
    PINNED_KEYS,
    type RowState,
    rowPartOf,
    type SummaryCellState,
    summaryCellPartOf,
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
import { layerRef } from "../utils/layer-ref";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";
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
    const { state, props, measured } = rowPartOf(view, row);
    return {
        state,
        // a measured row's height is read by the engine (Epic #86)
        ref: measured ? layerRef(engine, "row") : undefined,
        props,
    };
}

/** `useCell`, and how many columns the cell spans (a table cell's `colSpan`). */
export function useCellPart<TRow>(
    cell: CellInfo<TRow>,
): PartHookResult<CellState> & { columnSpan: number; measured: boolean } {
    return cellPartOf(useGridView<TRow>(), cell);
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
    return summaryCellPartOf(useGridView<TRow>(), cell);
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
