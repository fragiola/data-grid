import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { describe, expect, it } from "vitest";
import {
    DataGridLocalRows,
    injectLocalRows,
    type LocalRowsResult,
} from "../src/local";
import { type Column, DATA_GRID, type DataGridNode } from "../src/public-api";
import {
    cellAt,
    click,
    keyDown,
    render,
    root,
    rowAt,
    settled,
    stubViewportSize,
} from "./helpers";

// Tree data in Angular (Epic #87, E3.3): `injectLocalRows` with `getSubRows` hands the root a tree
// whose parents are data rows that expand by their key: the app's toggle
// (`*dataGridGroupToggle`), Space and the arrows open them, ARIA tells their level, and a parent
// selects itself (its rows by the app's own checkbox).

interface File {
    name: string;
    children?: File[];
}

const files: File[] = [
    {
        name: "src",
        children: [
            { name: "app.ts" },
            { name: "lib", children: [{ name: "a.ts" }] },
        ],
    },
    { name: "package.json" },
];

const columns: Column<File, DataGridNode>[] = [
    { key: "name", name: "Name", width: 200 },
    {
        key: "kind",
        name: "Kind",
        width: 100,
        getValue: (file) => (file.children ? "folder" : "file"),
    },
];

const getSubRows = (file: File) => file.children;
const rowKey = (file: File) => file.name;

stubViewportSize(600, 400);

let latest: LocalRowsResult<File> | undefined;

// the first column's cell: the toggle and the name; the others the cell's own content
@Component({
    imports: [DATA_GRID, DataGridLocalRows],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        {{ tick() ? "" : "" }}
        <div dataGridRoot [dataGridLocalRows]="local" [columns]="columns" [rowHeight]="20" rowSelection="multiple">
            <div dataGridGrid>
                <div dataGridBody>
                    <ng-template dataGridRows [dataGridRows]="columns" let-row>
                        <div [dataGridRow]="row">
                            <ng-template dataGridCells [dataGridCells]="columns" let-cell>
                                <div [dataGridCell]="cell">@if (cell.columnIndex === 0) {<button *dataGridGroupToggle="cell" type="button" aria-label="Toggle"></button>{{ cell.row?.name ?? "" }}} @else {<ng-container *dataGridCellContent />}</div>
                            </ng-template>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
class Files {
    /** only renders it again */
    readonly tick = input(0);
    readonly columns = columns;
    readonly local = injectLocalRows(files, columns, { getSubRows, rowKey });

    constructor() {
        latest = this.local;
    }
}

const rowCount = (container: HTMLElement) =>
    container.querySelectorAll('[data-grid-part="row"]').length;

describe("tree data", () => {
    it("makes a treegrid of the top rows, a parent a data row that expands", async () => {
        const { container } = await render(Files);
        expect(
            root(container)
                .querySelector('[data-grid-part="grid"]')
                ?.getAttribute("role"),
        ).toBe("treegrid");
        expect(rowCount(container)).toBe(2);
        const src = rowAt(container, 0);
        expect(src.getAttribute("aria-level")).toBe("1");
        expect(src.getAttribute("aria-expanded")).toBe("false");
        expect(src.getAttribute("aria-setsize")).toBe("2");
        expect(src.hasAttribute("data-group-row")).toBe(false);
        expect(rowAt(container, 1).hasAttribute("aria-expanded")).toBe(false);
        expect(cellAt(container, 0, 1).textContent).toBe("folder");
    });

    it("expands a parent by its toggle, and by Space; Enter stays its cell's", async () => {
        const { container } = await render(Files);
        const toggle = cellAt(container, 0, 0).querySelector("button");
        if (!toggle) throw new Error("no toggle");
        click(toggle);
        await settled();
        expect(latest?.group.expandedKeys).toEqual(["src"]);
        expect(rowCount(container)).toBe(4);
        expect(rowAt(container, 2).getAttribute("aria-level")).toBe("2");
        expect(rowAt(container, 2).getAttribute("aria-posinset")).toBe("2");
        cellAt(container, 2, 1).focus();
        await settled();
        keyDown(cellAt(container, 2, 1), { key: "Enter" });
        await settled();
        expect(rowCount(container)).toBe(4);
        keyDown(cellAt(container, 2, 1), { key: " " });
        await settled();
        expect(latest?.group.expandedKeys).toEqual(["src", "lib"]);
        expect(rowCount(container)).toBe(5);
        expect(rowAt(container, 3).getAttribute("aria-level")).toBe("3");
    });

    it("selects a parent alone; its rows' keys are the app's to add", async () => {
        const { container } = await render(Files);
        cellAt(container, 0, 1).focus();
        await settled();
        keyDown(cellAt(container, 0, 1), { key: " ", shiftKey: true });
        await settled();
        expect(rowAt(container, 0).getAttribute("aria-selected")).toBe("true");
        expect(latest?.group.subRowKeysOf(0)).toEqual([
            "app.ts",
            "lib",
            "a.ts",
        ]);
        expect(latest?.group.subRowKeysOf(1)).toEqual([]);
    });

    it("keeps subRowKeysOf while the rows shown stay, and moves no row of a tree", async () => {
        const { fixture } = await render(Files);
        const first = latest?.group.subRowKeysOf;
        fixture.componentRef.setInput("tick", 1);
        await settled(fixture);
        expect(latest?.group.subRowKeysOf).toBe(first);
        expect(latest?.moveRow({ fromIndex: 0, toIndex: 1 })).toBe(files);
    });
});
