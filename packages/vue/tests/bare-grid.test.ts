import { describe, expect, it } from "vitest";
import type { VNodeChild } from "vue";
import {
    type CellInfo,
    type Column,
    type HeaderCellInfo,
    type RowInfo,
    typedDataGrid,
} from "../src";
import { navigation } from "../src/navigation";
import {
    cellAt,
    click,
    h,
    keyDown,
    renderGrid,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

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

const columns: Column<Person, VNodeChild>[] = [
    { key: "name", name: "Name", width: 150 },
    { key: "age", name: "Age", width: 80 },
];

const NAVIGATION = [navigation()] as const;

const Bare = typedDataGrid<Person>();
const Navigated = typedDataGrid<Person, typeof NAVIGATION>();

stubViewportSize(400, 235);

/** The grid's parts, as divs or as a table's elements. */
function parts(table: boolean) {
    const tag = tags(table);
    return () => [
        h(Bare.Grid, { as: tag.grid }, () => [
            h(Bare.Header, { as: tag.header }, () => [
                h(Bare.HeaderRow, { as: tag.headerRow }, () => [
                    h(Bare.HeaderCells, null, {
                        default: ({ cell }: { cell: HeaderCellInfo<Person> }) =>
                            h(Bare.HeaderCell, { cell, as: tag.headerCell }),
                    }),
                ]),
            ]),
            h(Bare.Body, { as: tag.body }, () => [
                h(Bare.Rows, null, {
                    default: ({ row }: { row: RowInfo<Person> }) =>
                        h(Bare.Row, { row, as: tag.row }, () => [
                            h(Bare.Cells, null, {
                                default: ({
                                    cell,
                                }: {
                                    cell: CellInfo<Person>;
                                }) => h(Bare.Cell, { cell, as: tag.cell }),
                            }),
                        ]),
                }),
            ]),
        ]),
    ];
}

/** A grid without features, or with navigation alone. */
function grid(table: boolean, navigated: boolean) {
    const props = {
        columns,
        rows: people,
        rowHeight: 20,
        headerRowHeight: 20,
    };
    return navigated
        ? h(
              Navigated.Root,
              { ...props, features: NAVIGATION },
              { default: parts(table) },
          )
        : h(Bare.Root, props, { default: parts(table) });
}

const gridOf = (container: HTMLElement) =>
    container.querySelector('[data-grid-part="grid"]');

for (const table of [false, true]) {
    describe(`a grid without features (table: ${table})`, () => {
        it("is a table of cells, with column headers", async () => {
            const { container, unmount } = renderGrid(() => grid(table, false));
            await settled();
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
            unmount();
        });

        it("has no tab stop: no tabindex on the grid nor on a cell", async () => {
            const { container, unmount } = renderGrid(() => grid(table, false));
            await settled();
            expect(gridOf(container)).not.toHaveAttribute("tabindex");
            for (const cell of container.querySelectorAll(
                '[data-grid-part="cell"], [data-grid-part="header-cell"]',
            )) {
                expect(cell).not.toHaveAttribute("tabindex");
            }
            unmount();
        });

        it("does nothing on a click nor on ArrowDown: no cell becomes active", async () => {
            const { container, unmount } = renderGrid(() => grid(table, false));
            await settled();
            const cell = cellAt(container, 0, 0);
            click(cell);
            await settled();
            expect(container.querySelector("[data-active]")).toBeNull();
            const event = keyDown(cell, { key: "ArrowDown" });
            await settled();
            expect(event.defaultPrevented).toBe(false);
            expect(container.querySelector("[data-active]")).toBeNull();
            expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(
                0,
            );
            unmount();
        });
    });

    describe(`a grid with navigation (table: ${table})`, () => {
        it("is a grid of gridcells, with column headers", async () => {
            const { container, unmount } = renderGrid(() => grid(table, true));
            await settled();
            expect(gridOf(container)).toHaveAttribute("role", "grid");
            expect(cellAt(container, 0, 0)).toHaveAttribute("role", "gridcell");
            expect(cellAt(container, -1, 0)).toHaveAttribute(
                "role",
                "columnheader",
            );
            unmount();
        });

        it("has one roving tab stop, moved by the keys", async () => {
            const { container, unmount } = renderGrid(() => grid(table, true));
            await settled();
            // no cell active yet: the grid is the tab stop
            expect(gridOf(container)).toHaveAttribute("tabindex", "0");
            expect(cellAt(container, 0, 0)).toHaveAttribute("tabindex", "-1");
            // the first arrow makes the first cell in view active, the next one moves it
            const element = gridOf(container) as HTMLElement;
            expect(
                keyDown(element, { key: "ArrowDown" }).defaultPrevented,
            ).toBe(true);
            await settled();
            expect(cellAt(container, 0, 0)).toHaveAttribute("tabindex", "0");
            expect(cellAt(container, 0, 0)).toHaveAttribute("data-active", "");
            keyDown(cellAt(container, 0, 0), { key: "ArrowDown" });
            await settled();
            const active = cellAt(container, 1, 0);
            expect(active).toHaveAttribute("data-active", "");
            expect(active).toHaveAttribute("tabindex", "0");
            expect(gridOf(container)).toHaveAttribute("tabindex", "-1");
            expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(
                1,
            );
            unmount();
        });
    });
}
