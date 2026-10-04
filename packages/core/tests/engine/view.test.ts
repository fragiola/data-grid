import { describe, expect, it } from "vitest";
import type { ColumnOrGroup, GridView } from "../../src";
import {
    activeColumn,
    buildView,
    scrollingWindow,
    viewChanged,
} from "../../src/engine/view";
import {
    COLUMNS,
    column,
    inputsOf,
    type Row,
    stateOf,
    windowOf,
} from "./views";

// The view as pure functions of the state, the windows and the sizes: no engine, no DOM.

describe("scrollingWindow", () => {
    it("is the window itself without pinned columns in it", () => {
        const columns = windowOf(3, 6);
        expect(scrollingWindow(columns, 0)).toBe(columns);
        expect(scrollingWindow(columns, 3)).toBe(columns);
    });

    it("starts the ranges after the pinned columns the overscan reached into", () => {
        expect(
            scrollingWindow(
                {
                    visible: { start: 2, end: 5 },
                    rendered: { start: 0, end: 7 },
                },
                2,
            ),
        ).toEqual({
            visible: { start: 2, end: 5 },
            rendered: { start: 2, end: 7 },
        });
    });

    it("leaves an empty range at the pinned columns' end when it holds only them", () => {
        expect(scrollingWindow(windowOf(0, 1), 2)).toEqual(windowOf(2, 2));
    });
});

describe("activeColumn", () => {
    const state = stateOf();

    it("is none without an active cell, or for a pinned column", () => {
        expect(activeColumn(null, state.header, 0, { start: 2, end: 5 })).toBe(
            null,
        );
        expect(
            activeColumn({ rowIndex: 3, columnIndex: 1 }, state.header, 2, {
                start: 2,
                end: 5,
            }),
        ).toBe(null);
    });

    it("is a body cell's column, in the window or not", () => {
        const rendered = { start: 2, end: 5 };
        expect(
            activeColumn(
                { rowIndex: 3, columnIndex: 8 },
                state.header,
                0,
                rendered,
            ),
        ).toBe(8);
        expect(
            activeColumn(
                { rowIndex: 3, columnIndex: 3 },
                state.header,
                0,
                rendered,
            ),
        ).toBe(3);
    });

    it("is a header cell's column outside the window, none inside it", () => {
        const rendered = { start: 2, end: 5 };
        expect(
            activeColumn(
                { rowIndex: -1, columnIndex: 8 },
                state.header,
                0,
                rendered,
            ),
        ).toBe(8);
        expect(
            activeColumn(
                { rowIndex: -1, columnIndex: 3 },
                state.header,
                0,
                rendered,
            ),
        ).toBe(null);
    });

    it("is none for a header cell whose span reaches into the window", () => {
        const columns: ColumnOrGroup<Row>[] = [
            { key: "g", children: [column("a"), column("b"), column("c")] },
            column("d"),
        ];
        const { header } = stateOf({ columns });
        const group = { rowIndex: -2, columnIndex: 0 };
        expect(activeColumn(group, header, 0, { start: 2, end: 4 })).toBe(null);
        expect(activeColumn(group, header, 0, { start: 3, end: 4 })).toBe(0);
    });
});

describe("buildView", () => {
    it("renders the windows, the active cell outside them and the pinned columns first", () => {
        const state = stateOf({
            columns: [column("p0", true), column("p1", true), ...COLUMNS],
            activePosition: { rowIndex: 50, columnIndex: 9 },
        });
        const view = buildView(
            inputsOf(state, { pinnedColumnCount: 2, pinnedWidth: 200 }),
        );
        expect(view.rows).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 50]);
        expect(view.columns).toEqual([0, 1, 2, 3, 4, 9]);
        expect(view.renderedRows).toEqual({ start: 10, end: 20 });
        expect(view.renderedColumns).toEqual({ start: 2, end: 5 });
        expect(view.rowBase).toBe(200);
        expect(view.columnBase).toBe(200);
        expect(view.pinnedColumnCount).toBe(2);
        expect(view.pinnedWidth).toBe(200);
        expect(view.active).toEqual({ rowIndex: 50, columnIndex: 9 });
    });

    it("carries the measures, the header and the state's fields", () => {
        const state = stateOf();
        const inputs = inputsOf(state, {
            rowsRevision: 4,
            interaction: { rowIndex: 1, columnIndex: 2 },
        });
        const view = buildView(inputs);
        expect(view).toMatchObject({
            width: 1_000,
            height: 2_000,
            viewportWidth: 300,
            viewportBodyHeight: 170,
            rowsRevision: 4,
            interaction: { rowIndex: 1, columnIndex: 2 },
            headerRowCount: 1,
            headerRowHeight: 30,
            headerHeight: 30,
            rowCount: 100,
            columnCount: 10,
        });
        expect(view.rowAxis).toBe(inputs.rowAxis);
        expect(view.columnAxis).toBe(inputs.columnAxis);
        expect(view.header).toBe(state.header);
        expect(view.columnDefs).toBe(state.columns);
        expect(view.source).toBe(state.source);
        // the inputs' own fields stay out of the view
        expect(view).not.toHaveProperty("state");
        expect(view).not.toHaveProperty("headerRowsFor");
        expect(view.headerRows).toHaveLength(1);
        expect(view.headerRows[0]?.rowIndex).toBe(-1);
        expect(
            view.headerRows[0]?.cells.map((cell) => cell.columnIndex),
        ).toEqual([2, 3, 4]);
    });

    it("has no header rows without a header", () => {
        const view = buildView(
            inputsOf(stateOf({ headerRowHeight: 0 }), { headerHeight: 0 }),
        );
        expect(view.headerRowCount).toBe(0);
        expect(view.headerHeight).toBe(0);
        expect(view.headerRows).toEqual([]);
    });

    it("lays the header rows out again only when what they show changes", () => {
        const inputs = inputsOf();
        const first = buildView(inputs);
        expect(buildView(inputs).headerRows).toBe(first.headerRows);
        expect(
            buildView({ ...inputs, columnWindow: windowOf(3, 6) }).headerRows,
        ).not.toBe(first.headerRows);
    });
});

describe("viewChanged", () => {
    const changed = (
        a: GridView<Row, unknown>,
        b: GridView<Row, unknown>,
    ): boolean => viewChanged(a, b);

    it("is false for a view built again from the same inputs", () => {
        const inputs = inputsOf();
        expect(changed(buildView(inputs), buildView(inputs))).toBe(false);
    });

    it("is true when the rendered ranges move", () => {
        const inputs = inputsOf();
        const view = buildView(inputs);
        expect(
            changed(
                view,
                buildView({ ...inputs, rowWindow: windowOf(11, 21) }),
            ),
        ).toBe(true);
        expect(
            changed(
                view,
                buildView({ ...inputs, columnWindow: windowOf(3, 6) }),
            ),
        ).toBe(true);
    });

    it("is false when only the visible ranges move inside the rendered ones", () => {
        const inputs = inputsOf();
        expect(
            changed(
                buildView(inputs),
                buildView({
                    ...inputs,
                    rowWindow: {
                        visible: { start: 12, end: 18 },
                        rendered: { start: 10, end: 20 },
                    },
                }),
            ),
        ).toBe(false);
    });

    it("is true when a field a render reads changes", () => {
        const inputs = inputsOf();
        const view = buildView(inputs);
        expect(changed(view, buildView({ ...inputs, rowsRevision: 1 }))).toBe(
            true,
        );
        expect(
            changed(
                view,
                buildView({
                    ...inputs,
                    interaction: { rowIndex: 12, columnIndex: 3 },
                }),
            ),
        ).toBe(true);
        expect(changed(view, buildView({ ...inputs, height: 2_001 }))).toBe(
            true,
        );
    });

    it("ignores a resize of a grid with rows and no detail on screen", () => {
        const inputs = inputsOf();
        expect(
            changed(
                buildView(inputs),
                buildView({
                    ...inputs,
                    viewportWidth: 400,
                    viewportBodyHeight: 300,
                }),
            ),
        ).toBe(false);
    });

    it("renders a resize of an empty grid", () => {
        const inputs = inputsOf(stateOf({ rows: [] }), {
            rowWindow: windowOf(0, 0),
        });
        const view = buildView(inputs);
        expect(
            changed(view, buildView({ ...inputs, viewportWidth: 400 })),
        ).toBe(true);
        expect(
            changed(view, buildView({ ...inputs, viewportBodyHeight: 300 })),
        ).toBe(true);
    });

    it("renders a new width while an expanded row's detail is on screen", () => {
        const shown = inputsOf(stateOf({ expandedRowKeys: [12] }));
        expect(
            changed(
                buildView(shown),
                buildView({ ...shown, viewportWidth: 400 }),
            ),
        ).toBe(true);
        // expanded, but neither rendered nor active: nothing to widen
        const offScreen = inputsOf(stateOf({ expandedRowKeys: [60] }));
        expect(
            changed(
                buildView(offScreen),
                buildView({ ...offScreen, viewportWidth: 400 }),
            ),
        ).toBe(false);
    });
});
