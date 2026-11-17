import { describe, expect, it } from "vitest";
import { navigation } from "../src/navigation";
import type { Column, DataGridNode } from "../src/public-api";
import { renderTestGrid } from "./grid";
import { cellAt, click, keyDown, settled, stubViewportSize } from "./helpers";

// A grid without features (Epic #144): the APG table, not a grid. The grid is a `table`, its body
// cells `cell`s, its header cells `columnheader`s; neither the grid nor a cell is a tab stop, no
// cell is ever active, the arrows do nothing. Navigation installed makes it a `grid` of
// `gridcell`s with one roving tab stop, moved by the keys.

interface Person {
    name: string;
    age: number;
}

const people: Person[] = Array.from({ length: 20 }, (_, i) => ({
    name: `Person ${i}`,
    age: 20 + i,
}));

const columns: Column<Person, DataGridNode>[] = [
    { key: "name", name: "Name", width: 150 },
    { key: "age", name: "Age", width: 80 },
];

const NAVIGATION = [navigation()] as const;

stubViewportSize(400, 235);

/** A grid without features (`[]`: the test features not installed), or with navigation alone. */
const grid = (table: boolean, navigated: boolean) =>
    renderTestGrid(
        {
            columns,
            rows: people,
            rowHeight: 20,
            headerRowHeight: 20,
            features: navigated ? NAVIGATION : [],
        },
        { table },
    );

const gridOf = (container: HTMLElement) =>
    container.querySelector('[data-grid-part="grid"]');

for (const table of [false, true]) {
    describe(`a grid without features (table: ${table})`, () => {
        it("is a table of cells, with column headers", async () => {
            const { container } = await grid(table, false);
            expect(gridOf(container)).toHaveAttribute("role", "table");
            expect(cellAt(container, 0, 0)).toHaveAttribute("role", "cell");
            expect(cellAt(container, 3, 1)).toHaveAttribute("role", "cell");
            expect(cellAt(container, -1, 0)).toHaveAttribute(
                "role",
                "columnheader",
            );
            expect(
                container.querySelectorAll('[role="gridcell"], [role="grid"]'),
            ).toHaveLength(0);
        });

        it("has no tab stop: no tabindex on the grid nor on a cell", async () => {
            const { container } = await grid(table, false);
            expect(gridOf(container)).not.toHaveAttribute("tabindex");
            for (const cell of container.querySelectorAll(
                '[data-grid-part="cell"], [data-grid-part="header-cell"]',
            )) {
                expect(cell).not.toHaveAttribute("tabindex");
            }
        });

        it("does nothing on a click nor on ArrowDown: no cell becomes active", async () => {
            const { container, fixture } = await grid(table, false);
            const cell = cellAt(container, 0, 0);
            click(cell);
            await settled(fixture);
            expect(container.querySelector("[data-active]")).toBeNull();
            const event = keyDown(cell, { key: "ArrowDown" });
            await settled(fixture);
            expect(event.defaultPrevented).toBe(false);
            expect(container.querySelector("[data-active]")).toBeNull();
            expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(
                0,
            );
        });
    });

    describe(`a grid with navigation (table: ${table})`, () => {
        it("is a grid of gridcells, with column headers", async () => {
            const { container } = await grid(table, true);
            expect(gridOf(container)).toHaveAttribute("role", "grid");
            expect(cellAt(container, 0, 0)).toHaveAttribute("role", "gridcell");
            expect(cellAt(container, -1, 0)).toHaveAttribute(
                "role",
                "columnheader",
            );
        });

        it("has one roving tab stop, moved by the keys", async () => {
            const { container, fixture } = await grid(table, true);
            // no cell active yet: the grid is the tab stop
            expect(gridOf(container)).toHaveAttribute("tabindex", "0");
            expect(cellAt(container, 0, 0)).toHaveAttribute("tabindex", "-1");
            // the first arrow makes the first cell in view active, the next one moves it
            const element = gridOf(container) as HTMLElement;
            expect(
                keyDown(element, { key: "ArrowDown" }).defaultPrevented,
            ).toBe(true);
            await settled(fixture);
            expect(cellAt(container, 0, 0)).toHaveAttribute("tabindex", "0");
            expect(cellAt(container, 0, 0)).toHaveAttribute("data-active", "");
            keyDown(cellAt(container, 0, 0), { key: "ArrowDown" });
            await settled(fixture);
            const active = cellAt(container, 1, 0);
            expect(active).toHaveAttribute("data-active", "");
            expect(active).toHaveAttribute("tabindex", "0");
            expect(gridOf(container)).toHaveAttribute("tabindex", "-1");
            expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(
                1,
            );
        });
    });
}
