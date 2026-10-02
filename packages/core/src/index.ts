// @fragiola/data-grid: the framework-free core of the headless data grid.

export { type Axis, createAxis, type Size } from "./axis/axis";
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
