// @fragiola/data-grid: the framework-free core of the headless data grid.

export { type Axis, createAxis, type Size } from "./axis/axis";
export {
    ariaRowCount,
    ariaRowIndex,
    columnLeft,
    createDataGridEngine,
    type DataGridEngine,
    type DataGridEngineOptions,
    type EngineActionKey,
    type EngineActionMap,
    type EngineAdapter,
    type EngineEventKey,
    type EngineEventMap,
    type EngineLayer,
    type EngineQueryKey,
    type EngineQueryMap,
    type GridView,
    renderedWidth,
    rowTop,
} from "./engine/engine";
export {
    COMMANDS,
    cellValue,
    createDataGridModel,
    type DataGridModel,
    veto,
} from "./model/model";
export type {
    CellPosition,
    CellRenderProps,
    Column,
    CommandArgs,
    CommandContext,
    CommandContextBase,
    CommandError,
    CommandErrorCode,
    CommandEvent,
    CommandListener,
    CommandMap,
    CommandName,
    CommandResult,
    DataGridModelOptions,
    DataGridState,
    DataSetPayload,
    HeaderCellRenderProps,
    Middleware,
    PayloadArgs,
    PayloadOf,
    QueryKey,
    QueryMap,
    QuestionKey,
    QuestionMap,
    ResultOf,
    RowKeyGetter,
    RowSource,
} from "./model/types";
export {
    DIRECTIONS,
    type Direction,
    type GridBounds,
    nextPosition,
} from "./navigation/navigation";
export {
    createScrollMapping,
    DEFAULT_MAX_SCROLL_SIZE,
    ScrollAxisState,
    type ScrollMapping,
} from "./viewport/scaling";
export { type ScrollAlign, scrollTargetFor } from "./viewport/scroll-target";
export {
    type AxisWindow,
    contains,
    EMPTY_RANGE,
    EMPTY_WINDOW,
    type Range,
    sameRange,
    sameWindow,
    visibleRange,
    windowFor,
    withOverscan,
} from "./viewport/window";
