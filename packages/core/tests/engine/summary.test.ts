// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
    ariaRowCount,
    ariaRowIndex,
    type Column,
    cellBox,
    cellSpan,
    rowColumns,
    summaryCellPart,
    summaryHeight,
    summaryRowPart,
} from "../../src";
import { buildView, viewChanged } from "../../src/engine/view";
import {
    cellElement,
    fakeContentWidth,
    keydown,
    mountEngine,
    type Row,
} from "./harness";
import { inputsOf, stateOf, viewOf } from "./views";

// Summary rows in the engine (Epic #86, E2.1): they take their height from the body's, are always
// rendered (never in the row window), are counted by ARIA after the header's rows and after the
// body's, span with the columns' `colSpan`, and take the keys like body cells.

const SUMMARY = { summaryRows: { top: 1, bottom: 2 }, summaryRowHeight: 25 };

describe("the view of a grid with summary rows", () => {
    it("tells their counts and height, unchanged without them", () => {
        const view = viewOf(stateOf(SUMMARY));
        expect(view.summaryRows).toEqual({ top: 1, bottom: 2 });
        expect(view.summaryRowHeight).toBe(25);
        expect(summaryHeight(view, "top")).toBe(25);
        expect(summaryHeight(view, "bottom")).toBe(50);
        const plain = viewOf();
        expect(plain.summaryRows).toEqual({ top: 0, bottom: 0 });
        expect(summaryHeight(plain, "bottom")).toBe(0);
    });

    it("counts them in ARIA: the top ones after the header's rows, the bottom ones after the body's", () => {
        const view = viewOf(stateOf(SUMMARY));
        expect(ariaRowCount(view)).toBe(1 + 1 + 100 + 2);
        expect(ariaRowIndex(view, -1)).toBe(1);
        expect(ariaRowIndex(view, -2)).toBe(2);
        expect(ariaRowIndex(view, 0)).toBe(3);
        expect(ariaRowIndex(view, 99)).toBe(102);
        expect(ariaRowIndex(view, 100)).toBe(103);
        expect(ariaRowIndex(view, 101)).toBe(104);
        // without them, as before
        const plain = viewOf();
        expect(ariaRowCount(plain)).toBe(101);
        expect(ariaRowIndex(plain, -1)).toBe(1);
        expect(ariaRowIndex(plain, 0)).toBe(2);
    });

    it("never renders an active summary row as a body row", () => {
        const state = stateOf({
            ...SUMMARY,
            activePosition: { rowIndex: 100, columnIndex: 3 },
        });
        expect(viewOf(state).rows).toEqual(
            Array.from({ length: 10 }, (_, i) => 10 + i),
        );
    });

    it("spans their cells with the columns' colSpan, asked with the summary row", () => {
        const columns: Column<Row>[] = Array.from({ length: 10 }, (_, i) => ({
            key: `c${i}`,
            width: 100,
            ...(i === 2
                ? {
                      colSpan: (args) =>
                          args.type === "summary" && args.position === "bottom"
                              ? 2
                              : undefined,
                  }
                : {}),
        }));
        const view = viewOf(stateOf({ ...SUMMARY, columns }));
        expect(cellSpan(view, 100, 2)).toBe(2);
        expect(cellSpan(view, 101, 2)).toBe(2);
        expect(cellSpan(view, -2, 2)).toBe(1);
        expect(rowColumns(view, 100)).toEqual([2, 4]);
        expect(rowColumns(view, -2)).toEqual([2, 3, 4]);
        // a body row spans nothing
        expect(view.rowSpans?.has(10)).toBe(false);
    });

    it("gives a summary row's part and its cells' their state", () => {
        const state = stateOf({
            ...SUMMARY,
            activePosition: { rowIndex: 101, columnIndex: 3 },
        });
        const view = viewOf(state);
        expect(
            summaryRowPart(view, {
                rowIndex: 101,
                position: "bottom",
                summaryIndex: 1,
            }).state,
        ).toEqual({
            rowIndex: 101,
            position: "bottom",
            summaryIndex: 1,
            active: true,
        });
        const part = summaryCellPart(view, {
            rowIndex: 101,
            columnIndex: 3,
            position: "bottom",
            summaryIndex: 1,
        });
        expect(part.state).toMatchObject({
            rowIndex: 101,
            columnIndex: 3,
            loaded: true,
            active: true,
            position: "bottom",
            summaryIndex: 1,
        });
        expect(part.tabIndex).toBe(0);
        expect(cellBox(view, 101, 3, 1, view.summaryRowHeight)).toMatchObject({
            width: 100,
            height: 25,
        });
    });

    it("publishes no new view for a resize alone, and one when their figures change", () => {
        const resized = (state: ReturnType<typeof stateOf>) => {
            const inputs = inputsOf(state);
            return viewChanged(
                buildView(inputs),
                buildView({ ...inputs, viewportBodyHeight: 300 }),
            );
        };
        expect(resized(stateOf(SUMMARY))).toBe(false);
        const inputs = inputsOf(stateOf(SUMMARY));
        expect(
            viewChanged(
                buildView(inputs),
                buildView({
                    ...inputs,
                    state: { ...inputs.state, summaryRevision: 1 },
                }),
            ),
        ).toBe(true);
    });
});

describe("the engine with summary rows", () => {
    it("takes their height from the body's", () => {
        const { engine, view, model } = mountEngine(
            { rowCount: 1_000, columns: COLUMNS, ...SUMMARY },
            { height: 260 },
        );
        // 260 − a 30px header − three 25px summary rows
        expect(engine.get("viewport-size").bodyHeight).toBe(155);
        expect(view().viewportBodyHeight).toBe(155);
        model.run("summary-rows.set", {});
        expect(engine.get("viewport-size").bodyHeight).toBe(230);
    });

    it("moves the keys from a summary row's cell, never scrolling for its row", () => {
        const { engine, model, grid, scroll } = mountEngine({
            rowCount: 1_000,
            columns: COLUMNS,
            ...SUMMARY,
        });
        model.run("active-position.set", { rowIndex: 1_000, columnIndex: 1 });
        const top = scroll.top;
        const element = cellElement(grid, 1_000, 1);
        expect(keydown(engine, element, "ArrowDown").handled).toBe(true);
        expect(model.get("active-position")).toEqual({
            rowIndex: 1_001,
            columnIndex: 1,
        });
        expect(scroll.top).toBe(top);
        // selection keys are a body row's
        model.run("row-selection.set", { rowSelection: "multiple" });
        expect(keydown(engine, element, " ", { shiftKey: true }).handled).toBe(
            false,
        );
        expect(model.get("selected-row-keys")).toEqual([]);
    });

    it("keeps a summary cell's interaction and focus when its row index follows the rows and the header", () => {
        const { engine, model, grid, commit } = mountEngine({
            rowCount: 1_000,
            columns: COLUMNS,
            ...SUMMARY,
        });
        const element = cellElement(
            grid,
            1_001,
            1,
            '<input aria-label="Figure" />',
        );
        engine.run("interact-cell", { rowIndex: 1_001, columnIndex: 1 });
        const input = element.querySelector("input");
        expect(document.activeElement).toBe(input);
        expect(engine.get("interaction")).toEqual({
            rowIndex: 1_001,
            columnIndex: 1,
        });
        const top = engine.get("scroll-position").top;
        // rows added: the second bottom row is 1201 now, the same cell
        model.run("data.set", { rowCount: 1_200, getRow: (id) => ({ id }) });
        expect(model.get("active-position")).toEqual({
            rowIndex: 1_201,
            columnIndex: 1,
        });
        expect(engine.get("interaction")).toEqual({
            rowIndex: 1_201,
            columnIndex: 1,
        });
        // rendered again at its new index: focus stays in its field, nothing scrolls
        element.dataset.rowIndex = "1201";
        commit();
        expect(document.activeElement).toBe(input);
        expect(engine.get("interaction")).toEqual({
            rowIndex: 1_201,
            columnIndex: 1,
        });
        expect(engine.get("scroll-position").top).toBe(top);
    });

    it("fits a column to its summary rows' cells too", () => {
        const { engine, model, grid, commit } = mountEngine({
            rowCount: 3,
            columns: COLUMNS.map((entry) => ({ ...entry, resizable: true })),
            ...SUMMARY,
        });
        commit();
        fakeContentWidth(cellElement(grid, 0, 1), 60);
        fakeContentWidth(cellElement(grid, 3, 1), 180);
        fakeContentWidth(cellElement(grid, -2, 1), 90);
        engine.run("fit-columns", { columnKeys: ["c1"] });
        expect(model.get("column-widths")).toEqual({ c1: 180 });
    });
});

const COLUMNS: Column<Row>[] = Array.from({ length: 6 }, (_, i) => ({
    key: `c${i}`,
    width: 100,
}));
