import {
    ChangeDetectionStrategy,
    Component,
    InjectionToken,
    inject,
    input,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import { injectLocalRows } from "../src/local";
import {
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type DataGridRef,
    type RowInfo,
    type RowKey,
    type RowSelection,
    type RowState,
} from "../src/public-api";
import { injectSelectAll } from "../src/selection";
import { renderTestGrid, type TestProps, TestRootProps } from "./grid";
import {
    cellAt,
    click,
    keyDown,
    render,
    rowAt,
    settled,
    stubViewportSize,
} from "./helpers";

// Row selection (Epic #57, R1–R8): the root maps the selection (controlled or not), its mode and
// `isRowSelectable` onto the model; rows carry `data-selected` and `aria-selected`, the grid
// `aria-multiselectable`, as divs or as a table; `injectSelectAll` drives a "select all" control.

interface Person {
    id: string;
    locked: boolean;
}

const people: Person[] = Array.from({ length: 20 }, (_, i) => ({
    id: `p${i}`,
    locked: i === 3,
}));

const columns: Column<Person, DataGridNode>[] = [
    { key: "id", name: "Id", width: 120 },
];

stubViewportSize(400, 300);

const KEYS = people.map((person) => person.id);

/** The ref a "select all" control outside the root follows (none: the root around). */
const SELECT_ALL_REF = new InjectionToken<DataGridRef<Person>>("select all");

/** A header checkbox through injectSelectAll, as an app writes it. */
@Component({
    selector: "test-select-all",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <input type="checkbox" aria-label="Select all"
            [attr.data-status]="all.status"
            [attr.data-count]="all.count"
            [attr.data-can-toggle]="all.canToggle ? '' : null"
            [checked]="all.status === 'all'"
            (change)="all.toggle()" />
    `,
})
class SelectAll {
    readonly all = injectSelectAll<Person>(
        KEYS,
        inject(SELECT_ALL_REF, { optional: true }) ?? undefined,
    );
}

type GridProps = {
    /** `null`: rows not selectable */
    rowSelection?: RowSelection | null;
    selectedRowKeys?: readonly RowKey[];
    defaultSelectedRowKeys?: readonly RowKey[];
    onSelectedRowKeysChange?: (keys: readonly RowKey[]) => void;
    isRowSelectable?: (row: Person) => boolean;
};

/** The root's props of a selection grid. */
function propsOf({
    rowSelection = "multiple",
    ...props
}: GridProps = {}): TestProps<Person> {
    return {
        columns,
        rows: people,
        rowKey: (row: Person) => row.id,
        rowHeight: 20,
        rowSelection: rowSelection ?? undefined,
        ...props,
    };
}

/** Each state row 1 rendered with, as React's className function reads it. */
const rowStates: boolean[] = [];

/** The ref the "select all" outside the root follows. */
const OUTSIDE_REF = createDataGridRef<Person>();

/** A "select all" outside the root, through its gridRef. */
@Component({
    selector: "test-outside-select-all",
    imports: [SelectAll],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: SELECT_ALL_REF, useValue: OUTSIDE_REF }],
    template: `<div class="outside"><test-select-all /></div>`,
})
class OutsideSelectAll {}

/** The grid with a "select all" in its header cell, and its rows' states recorded. */
@Component({
    selector: "test-selection-grid",
    imports: [DATA_GRID, TestRootProps, SelectAll, OutsideSelectAll],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (outside()) {
            <test-outside-select-all />
        }
        <div dataGridRoot [columns]="props().columns" [testProps]="props()" [gridRef]="gridRef()">
            <div dataGridGrid>
                <div *dataGridHeader>
                    <ng-template dataGridHeaderRows let-row>
                        <div [dataGridHeaderRow]="row">
                            <ng-template dataGridHeaderCells let-cell>
                                <div [dataGridHeaderCell]="cell"><test-select-all /></div>
                            </ng-template>
                        </div>
                    </ng-template>
                </div>
                <div dataGridBody>
                    <ng-template dataGridRows let-row>
                        <div [dataGridRow]="row" #own="dataGridRow">
                            {{ record(row, own.state()) }}
                            <ng-template dataGridCells let-cell>
                                <div [dataGridCell]="cell"><ng-container *dataGridCellContent /></div>
                            </ng-template>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
class SelectionGrid {
    readonly props = input.required<TestProps<unknown>>();
    /** a "select all" before the root too, through `OUTSIDE_REF` */
    readonly outside = input(false);
    /** the root's gridRef (an input of the root, not one of its props; typed as `props`) */
    readonly gridRef = input<DataGridRef<unknown>>();

    record(row: RowInfo, state: RowState | undefined) {
        if (!state) return "";
        if (row.rowIndex === 1) rowStates.push(state.selected);
        return "";
    }
}

/** Renders the selection grid with `props`; `setProps` gives it new ones, settled. */
async function renderSelectionGrid(
    props: GridProps = {},
    {
        outside = false,
        gridRef,
    }: { outside?: boolean; gridRef?: DataGridRef<Person> } = {},
) {
    let fixture: ComponentFixture<SelectionGrid> | undefined;
    const rendered = await render(SelectionGrid, (created) => {
        fixture = created;
        created.componentRef.setInput("props", propsOf(props));
        created.componentRef.setInput("outside", outside);
        created.componentRef.setInput("gridRef", gridRef);
    });
    return {
        ...rendered,
        async setProps(next: GridProps) {
            fixture?.componentRef.setInput("props", propsOf(next));
            await settled(fixture);
        },
    };
}

/** A grid whose parent follows each selection it is told. */
async function renderControlled(gridRef?: DataGridRef<Person>) {
    const controlled = (keys: readonly RowKey[]): GridProps => ({
        selectedRowKeys: keys,
        onSelectedRowKeysChange: (next) => {
            void grid.setProps(controlled(next));
        },
    });
    const grid = await renderSelectionGrid(controlled([]), { gridRef });
    return grid;
}

const shiftSpace = (target: HTMLElement) =>
    keyDown(target, { key: " ", shiftKey: true });

const selectAllBox = (container: ParentNode) =>
    container.querySelector(
        'input[aria-label="Select all"]',
    ) as HTMLInputElement;

for (const table of [false, true]) {
    describe(`selected rows, as ${table ? "a table" : "divs"}`, () => {
        it("carry data-selected and aria-selected, the grid aria-multiselectable", async () => {
            const { container } = await renderTestGrid(
                propsOf({ defaultSelectedRowKeys: ["p1"] }),
                { table },
            );
            const gridElement = container.querySelector(
                '[data-grid-part="grid"]',
            );
            expect(gridElement).toHaveAttribute("aria-multiselectable", "true");
            expect(rowAt(container, 1)).toHaveAttribute("data-selected", "");
            expect(rowAt(container, 1)).toHaveAttribute(
                "aria-selected",
                "true",
            );
            expect(rowAt(container, 2)).not.toHaveAttribute("data-selected");
            expect(rowAt(container, 2)).toHaveAttribute(
                "aria-selected",
                "false",
            );
        });

        it("toggle on Shift+Space, uncontrolled, telling the app", async () => {
            const onChange = vi.fn();
            const { container } = await renderTestGrid(
                propsOf({ onSelectedRowKeysChange: onChange }),
                { table },
            );
            const cell = cellAt(container, 2);
            cell.focus();
            await settled();
            shiftSpace(cell);
            await settled();
            expect(onChange).toHaveBeenLastCalledWith(["p2"]);
            expect(rowAt(container, 2)).toHaveAttribute("data-selected", "");
        });
    });
}

describe("controlled selection", () => {
    it("follows the keys, asks for a toggle, and keeps the anchor for a range", async () => {
        const { container } = await renderControlled();
        const start = cellAt(container, 2);
        start.focus();
        await settled();
        shiftSpace(start);
        await settled();
        expect(rowAt(container, 2)).toHaveAttribute("data-selected", "");
        // the parent answered the toggle: the anchor is still row 2
        const cell = cellAt(container, 2);
        keyDown(cell, { key: "ArrowDown", shiftKey: true });
        await settled();
        keyDown(cellAt(container, 3), { key: "ArrowDown", shiftKey: true });
        await settled();
        for (const index of [2, 3, 4]) {
            expect(rowAt(container, index)).toHaveAttribute(
                "data-selected",
                "",
            );
        }
    });

    it("keeps a Shift+click's anchor without one before, as uncontrolled", async () => {
        const gridRef = createDataGridRef<Person>();
        const { container } = await renderControlled(gridRef);
        const run = (rowIndex: number, extend: boolean) =>
            gridRef.current?.model.run("selected-rows.toggle", {
                rowIndex,
                extend,
            });
        run(1, true);
        await settled();
        run(4, true);
        await settled();
        for (const index of [1, 2, 3, 4]) {
            expect(rowAt(container, index)).toHaveAttribute(
                "data-selected",
                "",
            );
        }
    });

    it("selects nothing the parent does not follow", async () => {
        const onChange = vi.fn();
        const { container } = await renderTestGrid(
            propsOf({ selectedRowKeys: [], onSelectedRowKeysChange: onChange }),
        );
        const cell = cellAt(container, 2);
        cell.focus();
        await settled();
        shiftSpace(cell);
        await settled();
        expect(onChange).toHaveBeenCalledWith(["p2"]);
        expect(rowAt(container, 2)).not.toHaveAttribute("data-selected");
    });
});

describe("modes and rows that cannot be selected", () => {
    it("single mode: no aria-multiselectable, one row at a time, the trimmed default told", async () => {
        const onChange = vi.fn();
        const { container } = await renderTestGrid(
            propsOf({
                onSelectedRowKeysChange: onChange,
                rowSelection: "single",
                defaultSelectedRowKeys: ["p1", "p2"],
            }),
        );
        expect(onChange).toHaveBeenCalledWith(["p2"]);
        const gridElement = container.querySelector('[data-grid-part="grid"]');
        expect(gridElement).not.toHaveAttribute("aria-multiselectable");
        expect(rowAt(container, 1)).not.toHaveAttribute("data-selected");
        expect(rowAt(container, 2)).toHaveAttribute("data-selected", "");
    });

    it("a row isRowSelectable refuses carries no aria-selected", async () => {
        const { container } = await renderTestGrid(
            propsOf({ isRowSelectable: (row) => !row.locked }),
        );
        expect(rowAt(container, 3)).not.toHaveAttribute("aria-selected");
        expect(rowAt(container, 4)).toHaveAttribute("aria-selected", "false");
    });

    it("without rowSelection, rows carry nothing and Shift+Space is not the grid's", async () => {
        const { container } = await renderTestGrid({
            columns,
            rows: people,
            rowHeight: 20,
        });
        expect(
            container.querySelectorAll("[aria-selected], [data-selected]"),
        ).toHaveLength(0);
        expect(container.querySelector("[aria-multiselectable]")).toBeNull();
        const cell = cellAt(container, 1);
        cell.focus();
        await settled();
        expect(shiftSpace(cell).defaultPrevented).toBe(false);
    });

    it("turns off and on with the prop, the keys kept meanwhile", async () => {
        const grid = await renderTestGrid(
            propsOf({ defaultSelectedRowKeys: ["p1"] }),
        );
        const { container } = grid;
        expect(rowAt(container, 1)).toHaveAttribute("data-selected", "");
        await grid.setProps(
            propsOf({ defaultSelectedRowKeys: ["p1"], rowSelection: null }),
        );
        expect(rowAt(container, 1)).not.toHaveAttribute("data-selected");
        expect(rowAt(container, 1)).not.toHaveAttribute("aria-selected");
        await grid.setProps(propsOf({ defaultSelectedRowKeys: ["p1"] }));
        expect(rowAt(container, 1)).toHaveAttribute("data-selected", "");
    });
});

describe("injectSelectAll", () => {
    it("tells none, some or all, and toggles every key", async () => {
        const { container } = await renderSelectionGrid();
        const box = selectAllBox(container);
        expect(box.dataset.status).toBe("none");
        click(box);
        await settled();
        expect(box.dataset.status).toBe("all");
        expect(box.dataset.count).toBe("20");
        expect(rowAt(container, 5)).toHaveAttribute("data-selected", "");
        const cell = cellAt(container, 5);
        cell.focus();
        await settled();
        shiftSpace(cell);
        await settled();
        expect(box.dataset.status).toBe("some");
        click(box);
        await settled();
        expect(box.dataset.status).toBe("all");
        click(box);
        await settled();
        expect(box.dataset.status).toBe("none");
    });

    it("only clears in single mode, and selects nothing while rows are not selectable", async () => {
        const grid = await renderSelectionGrid({
            rowSelection: "single",
            defaultSelectedRowKeys: ["p2"],
        });
        const { container } = grid;
        const box = () => selectAllBox(container);
        expect(box().dataset.status).toBe("some");
        expect(box()).toHaveAttribute("data-can-toggle");
        click(box());
        await settled();
        expect(box().dataset.status).toBe("none");
        expect(box()).not.toHaveAttribute("data-can-toggle");
        click(box());
        await settled();
        expect(box().dataset.status).toBe("none");
        await grid.setProps({
            rowSelection: null,
            defaultSelectedRowKeys: ["p2"],
        });
        click(box());
        await settled();
        expect(box().dataset.status).toBe("none");
        expect(container.querySelectorAll("[data-selected]")).toHaveLength(0);
    });

    it("works outside the root through a gridRef", async () => {
        const { container } = await renderSelectionGrid(
            {},
            { outside: true, gridRef: OUTSIDE_REF },
        );
        const outside = container.querySelector(
            '.outside input[aria-label="Select all"]',
        ) as HTMLInputElement;
        click(outside);
        await settled();
        expect(outside.dataset.status).toBe("all");
        expect(rowAt(container, 0)).toHaveAttribute("data-selected", "");
    });
});

describe("a row's state", () => {
    it("reports selected", async () => {
        rowStates.length = 0;
        await renderSelectionGrid({ defaultSelectedRowKeys: ["p1"] });
        expect(rowStates.at(-1)).toBe(true);
    });
});

describe("injectLocalRows", () => {
    it("returns every page's filtered rows", async () => {
        let result: ReturnType<typeof injectLocalRows<Person>> | undefined;
        @Component({ template: "" })
        class Local {
            constructor() {
                result = injectLocalRows(people, columns, { pageSize: 5 });
            }
        }
        await render(Local);
        expect(result?.rows).toHaveLength(5);
        expect(result?.filteredRows).toHaveLength(20);
        result?.filter.setSearch("p1");
        await settled();
        expect(result?.filteredRows.map((person) => person.id)).toEqual([
            "p1",
            "p10",
            "p11",
            "p12",
            "p13",
            "p14",
            "p15",
            "p16",
            "p17",
            "p18",
            "p19",
        ]);
    });
});
