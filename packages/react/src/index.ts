// @fragiola/data-grid-react: composable, unstyled React primitives over @fragiola/data-grid.
// The opt-in extras are entries of their own, never imported from here: rows in memory (`/local`)
// and the features, each re-exporting the core's of the same name: `/sorting`, `/navigation`,
// `/row-selection` (with `useSelectAll`), `/range`, `/clipboard`, `/fill` (with `useFillHandle`),
// `/editing` (with `useCellEdit`), and the column features (Epic #148): `/column-resize` (with
// `useColumnResizer`), `/column-reorder`, `/column-pinning`, `/column-group-collapse`, and the row
// features (Epic #151): `/row-expansion` (with `RowDetail`, `useRowDetail`), `/row-grouping` (with
// `useGroupToggle`), `/row-reorder` (with `useRowDragHandle`), `/spans`, `/summary-rows` (with
// `Summary`, `SummaryRows`, `SummaryRow`, `SummaryCells`, `SummaryCell` and their hooks). A grid
// without `navigation()` is a table: no keys, no active cell, no tab stop; without `editing()`, no
// cell is ever edited; without the column features, nothing resizes, moves, pins or collapses;
// without the row features, no detail, no group toggling, no row drag, no span, no summary row.

export type {
    AxisWindow,
    CellEdit,
    CellPosition,
    CellRange,
    CellSelection,
    CellState,
    ColSpanArgs,
    ColumnOrder,
    ColumnResizerState,
    ColumnWidths,
    DataGridEngine,
    DataGridFeature,
    DataGridFeatures,
    DataGridModel,
    DetailHeight,
    EditCellRenderProps,
    EditDraft,
    EditingCell,
    FillDrag,
    GridDirection,
    GridState,
    GroupCellRenderProps,
    GroupColSpanArgs,
    GroupLabelState,
    GroupRow,
    GroupShow,
    HeaderCellState,
    HeaderRowState,
    PinnedSide,
    Range,
    RangeFill,
    RangePaste,
    ReorderSide,
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
    SummaryCellRenderProps,
    SummaryCellState,
    SummaryPosition,
    SummaryRowCounts,
    SummaryRowState,
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
    useDataGrid,
} from "./context";
export { useCell } from "./hooks/use-cell";
export { useCells } from "./hooks/use-cells";
export { useColumnWindow } from "./hooks/use-column-window";
export {
    createDataGridRef,
    type DataGridRef,
    useDataGridRef,
} from "./hooks/use-data-grid-ref";
export { useGridView } from "./hooks/use-grid-view";
export { useGroupLabel } from "./hooks/use-group-label";
export { useHeaderCell } from "./hooks/use-header-cell";
export { useHeaderCells } from "./hooks/use-header-cells";
export { useHeaderRows } from "./hooks/use-header-rows";
export { useRow } from "./hooks/use-row";
export { useRowWindow } from "./hooks/use-row-window";
export { useRows } from "./hooks/use-rows";
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
    RowProps,
    RowsProps,
} from "./parts";
export * as DataGrid from "./parts";
export type {
    DivPrimitiveProps,
    PrimitiveProps,
    RenderedProps,
    RenderProp,
} from "./utils/use-render";
