import { NgClass } from "@angular/common";
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    type TemplateRef,
    viewChild,
} from "@angular/core";
import { describe, expect, it } from "vitest";
import {
    type CellTemplateProps,
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridNode,
    type HeaderCellState,
    type TemplateContext,
    templateContent,
} from "../src/public-api";
import { cellAt, keyDown, render, settled, stubViewportSize } from "./helpers";

// Interactive cells (Epic #52, I5): the cell whose controls have the keys carries
// `data-interacting`, its directives' state reports `interacting`, and the cells' controls stay
// out of the tab order outside it, as divs or as a table.

interface Task {
    id: number;
    title: string;
}

const tasks: Task[] = Array.from({ length: 20 }, (_, id) => ({
    id,
    title: `Task ${id}`,
}));

stubViewportSize(400, 300);

let headerStates: HeaderCellState[] = [];

/** Which columns the grid renders: the actions, a sortable header with a menu, a plain one. */
type Cells = "actions" | "menu" | "plain";

// React's `className` functions and Vue's `render` slot read the state: here the directives'
// `state()` does (`#cell="dataGridCell"`), the cell's class through `[ngClass]` (a directive
// input, set after the cell's own; a `[class.x]` binding on the cell would be read before it).
@Component({
    selector: "test-interaction-grid",
    imports: [DATA_GRID, NgClass],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-template #actions [dataGridTemplate]="cellContext" let-row="row"><button type="button">Edit {{ row.id }}</button><a [href]="'#task-' + row.id">Open {{ row.id }}</a></ng-template>
        <ng-template #menu [dataGridTemplate]="headerContext">Title <button type="button">Menu</button></ng-template>
        <div dataGridRoot [columns]="columns()" [rows]="rows" [rowHeight]="24">
            @if (table()) {
                <table dataGridGrid>
                    <thead *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <tr [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <th [dataGridHeaderCell]="cell" #header="dataGridHeaderCell">{{ record(header.state()) }}<ng-container *dataGridCellContent /></th>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </thead>
                    <tbody dataGridBody>
                        <ng-template dataGridRows let-row>
                            <tr [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <td [dataGridCell]="cell" #body="dataGridCell" [ngClass]="{ interacting: body.state()?.interacting }"><ng-container *dataGridCellContent /></td>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </tbody>
                </table>
            } @else {
                <div dataGridGrid>
                    <div *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <div [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <div [dataGridHeaderCell]="cell" #header="dataGridHeaderCell">{{ record(header.state()) }}<ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <div dataGridBody>
                        <ng-template dataGridRows let-row>
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell" #body="dataGridCell" [ngClass]="{ interacting: body.state()?.interacting }"><ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            }
        </div>
    `,
})
class InteractionGrid {
    readonly rows = tasks;
    readonly table = input(false);
    readonly cells = input<Cells>("actions");
    readonly cellContext = contextOf<CellTemplateProps<Task>>();
    readonly headerContext = contextOf<object>();
    readonly actions =
        viewChild.required<
            TemplateRef<TemplateContext<CellTemplateProps<Task>>>
        >("actions");
    readonly menu =
        viewChild.required<TemplateRef<TemplateContext<object>>>("menu");

    readonly columns = computed((): Column<Task, DataGridNode>[] => {
        switch (this.cells()) {
            case "menu":
                return [
                    {
                        key: "title",
                        name: "Title",
                        width: 160,
                        sortable: true,
                        renderHeaderCell: () =>
                            templateContent(this.menu(), {}),
                    },
                ];
            case "plain":
                return [{ key: "title", name: "Title", width: 160 }];
            default:
                return [
                    { key: "title", name: "Title", width: 160 },
                    {
                        key: "actions",
                        name: "Actions",
                        width: 160,
                        renderCell: (props) =>
                            templateContent(this.actions(), props),
                    },
                ];
        }
    });

    /** Records a header cell's state (its render); returns an empty string. */
    record(state: HeaderCellState | undefined): string {
        if (!state) return "";
        headerStates.push(state);
        return "";
    }
}

function grid({ table = false, cells = "actions" as Cells } = {}) {
    return render(InteractionGrid, (fixture) => {
        fixture.componentRef.setInput("table", table);
        fixture.componentRef.setInput("cells", cells);
    });
}

for (const table of [false, true]) {
    describe(`interactive cells, as ${table ? "a table" : "divs"}`, () => {
        it("keeps the cells' controls out of the tab order", async () => {
            const { container } = await grid({ table });
            const controls = container.querySelectorAll(
                '[data-grid-part="cell"] button, [data-grid-part="cell"] a',
            );
            expect(controls.length).toBeGreaterThan(0);
            for (const control of controls) {
                expect(control.getAttribute("tabindex")).toBe("-1");
            }
        });

        it("marks the cell whose controls have the keys, and its state", async () => {
            const { container } = await grid({ table });
            const actions = cellAt(container, 2, 1);
            actions.focus();
            await settled();
            keyDown(actions, { key: "Enter" });
            await settled();
            const cell = cellAt(container, 2, 1);
            expect(cell).toHaveAttribute("data-interacting", "");
            expect(cell).toHaveClass("interacting");
            const edit = cell.querySelector("button");
            expect(document.activeElement).toBe(edit);
            expect(edit?.hasAttribute("tabindex")).toBe(false);
            keyDown(edit as HTMLElement, { key: "Escape" });
            await settled();
            expect(cellAt(container, 2, 1)).not.toHaveAttribute(
                "data-interacting",
            );
            expect(document.activeElement).toBe(cellAt(container, 2, 1));
            await settled();
            expect(
                cellAt(container, 2, 1)
                    .querySelector("button")
                    ?.getAttribute("tabindex"),
            ).toBe("-1");
        });
    });
}

describe("interactive header cells", () => {
    it("report interacting on a header cell entered with F2", async () => {
        headerStates = [];
        const { container } = await grid({ cells: "menu" });
        const header = container.querySelector(
            '[data-grid-part="header-cell"]',
        ) as HTMLElement;
        header.focus();
        await settled();
        keyDown(header, { key: "F2" });
        await settled();
        expect(header).toHaveAttribute("data-interacting", "");
        expect(headerStates.at(-1)?.interacting).toBe(true);
    });
});

describe("a grid without controls in its cells", () => {
    it("carries no interaction attribute, and lets Enter through", async () => {
        const { container } = await grid({ cells: "plain" });
        const cell = cellAt(container, 0, 0);
        cell.focus();
        await settled();
        keyDown(cell, { key: "Enter" });
        await settled();
        expect(container.querySelectorAll("[data-interacting]")).toHaveLength(
            0,
        );
    });
});
