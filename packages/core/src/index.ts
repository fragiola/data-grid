// @fragiola/data-grid: the framework-free core of the headless data grid.

export type { Axis, Size } from "./axis/axis";
export { TAB_STOP_ATTRIBUTE } from "./engine/dom";
export { createDataGridEngine } from "./engine/engine";
export {
    ariaHeaderCellSpans,
    ariaRowCount,
    ariaRowDetail,
    ariaRowIndex,
    columnLeft,
    columnPinning,
    type HeaderCellSort,
    headerCellBox,
    headerCellSort,
    renderedWidth,
    rowCellsHeight,
    rowDetailBox,
    rowDisplay,
    rowExpanded,
    rowLeft,
    rowSelectable,
    rowSelected,
    rowTop,
    rowWidth,
} from "./engine/geometry";
export {
    type CellPart,
    type CellState,
    cellBox,
    cellPart,
    type HeaderCellPart,
    type HeaderCellState,
    headerCellPart,
    type RowDetailPart,
    type RowDetailState,
    type RowPart,
    type RowState,
    rowDetailPart,
    rowPart,
} from "./engine/parts";
export type {
    DataGridEngine,
    DataGridEngineOptions,
    EngineActionKey,
    EngineActionMap,
    EngineAdapter,
    EngineEventKey,
    EngineEventMap,
    EngineLayer,
    EngineQueryKey,
    EngineQueryMap,
    GridView,
    HeaderRowView,
} from "./engine/types";
export { DEFAULT_DETAIL_HEIGHT, sameRowKeys } from "./model/expansion";
export {
    createDataGridModel,
    type DataGridModel,
    DEFAULT_HEADER_ROW_HEIGHT,
    DEFAULT_ROW_HEIGHT,
} from "./model/model";
export { veto } from "./model/result";
export { sameSortColumns, validSortColumns } from "./model/sort";
export { cellValue, rowAt } from "./model/source";
export type {
    CellPosition,
    CellRenderProps,
    Column,
    ColumnGroup,
    ColumnOrGroup,
    CommandArgs,
    CommandContext,
    CommandError,
    CommandErrorCode,
    CommandEvent,
    CommandFailure,
    CommandListener,
    CommandMap,
    CommandName,
    CommandResult,
    DataGridModelOptions,
    DataGridState,
    DataSetPayload,
    DetailHeight,
    GroupHeaderCellRenderProps,
    HeaderCellLayout,
    HeaderCellRenderProps,
    HeaderLayout,
    Middleware,
    NoPayload,
    PayloadArgs,
    PayloadOf,
    QueryKey,
    QueryMap,
    QuestionKey,
    QuestionMap,
    ResultOf,
    RowKey,
    RowKeyGetter,
    RowSelectable,
    RowSelection,
    RowSource,
    SelectionAnchor,
    SortColumn,
    SortDirection,
} from "./model/types";
export {
    type Direction,
    type HeaderCellSpan,
    sameCell,
} from "./navigation/navigation";
export { DEFAULT_MAX_SCROLL_SIZE } from "./viewport/scaling";
export type { ScrollAlign } from "./viewport/scroll-target";
export {
    type AxisWindow,
    EMPTY_WINDOW,
    type Range,
} from "./viewport/window";
