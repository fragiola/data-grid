// @fragiola/data-grid-react: composable, unstyled React primitives over @fragiola/data-grid.

export type {
    AxisWindow,
    CellEdit,
    CellEditEvent,
    CellPosition,
    CellRange,
    CellSelection,
    CellState,
    ColSpanArgs,
    ColumnOrder,
    ColumnResizerState,
    ColumnWidths,
    DataGridEngine,
    DataGridModel,
    DetailHeight,
    EditCellRenderProps,
    EditDraft,
    EditingCell,
    FillDrag,
    FillHandleState,
    GridDirection,
    GridState,
    GroupCellRenderProps,
    GroupColSpanArgs,
    GroupLabelState,
    GroupRow,
    GroupShow,
    GroupToggleState,
    HeaderCellState,
    HeaderRowState,
    PinnedSide,
    Range,
    RangeFill,
    RangePaste,
    ReorderSide,
    RowDetailState,
    RowDragHandleState,
    RowHeight,
    RowKey,
    RowKeyGetter,
    RowMeta,
    RowMetaGetter,
    RowMove,
    RowReorder,
    RowSelectable,
    RowSelection,
    RowState,
    ScrollAlign,
    Size,
    SortColumn,
    SortDirection,
    SummaryCellRenderProps,
    SummaryCellState,
    SummaryPosition,
    SummaryRowCounts,
    SummaryRowState,
    SummaryState,
} from "@fragiola/data-grid";
// a middleware's refusal, and a header cell's default content: an app installs only this package
export { headerCellContent, veto } from "@fragiola/data-grid";
export {
    type CellInfo,
    type Column,
    type ColumnGroup,
    type ColumnOrGroup,
    type DataGridContextValue,
    type HeaderCellInfo,
    type HeaderRowInfo,
    type RowInfo,
    type SummaryCellInfo,
    type SummaryRowInfo,
    useDataGrid,
} from "./context";
export { useCell } from "./hooks/use-cell";
export { useCellEdit } from "./hooks/use-cell-edit";
export { useCells } from "./hooks/use-cells";
export { useColumnResizer } from "./hooks/use-column-resizer";
export { useColumnWindow } from "./hooks/use-column-window";
export {
    createDataGridRef,
    type DataGridRef,
    useDataGridRef,
} from "./hooks/use-data-grid-ref";
export { useFillHandle } from "./hooks/use-fill-handle";
export { useGridView } from "./hooks/use-grid-view";
export { useGroupLabel } from "./hooks/use-group-label";
export { useGroupToggle } from "./hooks/use-group-toggle";
export { useHeaderCell } from "./hooks/use-header-cell";
export { useHeaderCells } from "./hooks/use-header-cells";
export { useHeaderRows } from "./hooks/use-header-rows";
export { useRow } from "./hooks/use-row";
export { useRowDetail } from "./hooks/use-row-detail";
export { useRowDragHandle } from "./hooks/use-row-drag-handle";
export { useRowWindow } from "./hooks/use-row-window";
export { useRows } from "./hooks/use-rows";
export { useSummaryCell } from "./hooks/use-summary-cell";
export { useSummaryCells } from "./hooks/use-summary-cells";
export { useSummaryRow } from "./hooks/use-summary-row";
export { useSummaryRows } from "./hooks/use-summary-rows";
export type {
    BodyProps,
    CellProps,
    CellsProps,
    EmptyProps,
    GridProps,
    HeaderCellProps,
    HeaderCellsProps,
    HeaderProps,
    HeaderRowProps,
    HeaderRowsProps,
    RootProps,
    RootState,
    RowDetailProps,
    RowProps,
    RowsProps,
    SummaryCellProps,
    SummaryCellsProps,
    SummaryProps,
    SummaryRowProps,
    SummaryRowsProps,
} from "./parts";
export * as DataGrid from "./parts";
export type {
    DivPrimitiveProps,
    PrimitiveProps,
    RenderedProps,
    RenderProp,
} from "./utils/use-render";
