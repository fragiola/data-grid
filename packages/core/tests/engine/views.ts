import {
    type Column,
    createDataGridModel,
    type DataGridFeatures,
    type GridView,
    type ModelOptions,
} from "../../src";
import {
    buildView,
    columnAxisOf,
    createHeaderRows,
    rowAxisOf,
    type ViewInputs,
    withDetails,
} from "../../src/engine/view";
import {
    composeFeatures,
    featuresOf,
    type GridFeatures,
} from "../../src/feature/registry";
import type { AxisWindow } from "../../src/viewport/window";

// A view's inputs and the view itself, for the tests of the pure functions over it: 100 rows of
// 20px, 10 columns of 100px, a 30px header.

export interface Row {
    id: number;
}

export const column = (key: string, pinned = false): Column<Row> => ({
    key,
    width: 100,
    ...(pinned ? { pinned: "start" as const } : {}),
});

export const COLUMNS: Column<Row>[] = Array.from({ length: 10 }, (_, i) =>
    column(`c${i}`),
);

export const windowOf = (start: number, end: number): AxisWindow => ({
    visible: { start, end },
    rendered: { start, end },
});

/** The features of the states `stateOf` made (a view of one is built with them). */
const FEATURES = new WeakMap<object, GridFeatures>();

export function stateOf<const TFeatures extends DataGridFeatures = []>(
    options: ModelOptions<Row, unknown, TFeatures> = {},
) {
    const model = createDataGridModel<Row, unknown, TFeatures>({
        columns: COLUMNS,
        rows: Array.from({ length: 100 }, (_, id) => ({ id })),
        rowHeight: 20,
        headerRowHeight: 30,
        ...options,
    } as ModelOptions<Row, unknown, TFeatures>);
    FEATURES.set(model.state, featuresOf(model));
    return model.state;
}

/** The features a state was made with (`stateOf`), or none. */
export function featuresFor(state: object): GridFeatures {
    return FEATURES.get(state) ?? composeFeatures([]);
}

/** The inputs of a view of `state`, the rows 10–20 and the columns 2–5 rendered. */
export function inputsOf(
    state = stateOf(),
    overrides: Partial<ViewInputs<Row, unknown>> = {},
): ViewInputs<Row, unknown> {
    return {
        state,
        rowWindow: windowOf(10, 20),
        columnWindow: windowOf(2, 5),
        rowAxis: withDetails(rowAxisOf(state), state),
        columnAxis: columnAxisOf(state),
        width: 1_000,
        height: 2_000,
        headerHeight: 30,
        viewportWidth: 300,
        viewportBodyHeight: 170,
        pinnedColumnCount: 0,
        pinnedWidth: 0,
        pinnedEndColumnCount: 0,
        pinnedEndWidth: 0,
        rowsRevision: 0,
        interaction: null,
        tabbable: true,
        emptyShown: false,
        columnResize: null,
        columnReorder: null,
        reorderableRows: false,
        rowReorder: null,
        fillable: false,
        fill: null,
        fillSource: null,
        direction: "ltr",
        headerRowsFor: createHeaderRows<Row, unknown>(),
        features: featuresFor(state),
        ...overrides,
    };
}

/** A view of `state`, as `inputsOf` lays it out. */
export function viewOf(
    state = stateOf(),
    overrides: Partial<ViewInputs<Row, unknown>> = {},
): GridView<Row, unknown> {
    return buildView(inputsOf(state, overrides));
}
