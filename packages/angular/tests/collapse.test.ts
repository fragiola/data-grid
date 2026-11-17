import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import {
    type Column,
    type ColumnOrGroup,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
} from "../src/public-api";
import {
    cellAt,
    click,
    render,
    rendered,
    renders,
    resetRenders,
    root,
    scrollRoot,
    settled,
    stubViewportSize,
} from "./helpers";

// Collapsible groups and sticky labels (Epic #85, E1.3): the collapsed groups controlled or not
// on the root, toggled by the app's own control in the group's header cell; `data-collapsible`,
// `data-collapsed`; a group's label (`[dataGridGroupLabel]`) whose inset the engine writes while
// the group scrolls, Angular rendering nothing for it (D9). Both structures.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 30 }, (_, id) => ({ id }));

const column = (
    key: string,
    extra: Partial<Column<Row, DataGridNode>> = {},
): Column<Row, DataGridNode> => ({
    key,
    name: key.toUpperCase(),
    width: 100,
    getValue: (row) => `${row.id}${key}`,
    ...extra,
});

/** "id"; "g" collapsible ("g0" both, "g1"–"g5" expanded, "sum" collapsed); "h" (h0, h1); 20 more */
const COLUMNS: ColumnOrGroup<Row, DataGridNode>[] = [
    column("id"),
    {
        key: "g",
        name: "G",
        collapsible: true,
        children: [
            column("g0"),
            ...[1, 2, 3, 4, 5].map((i) =>
                column(`g${i}`, { groupShow: "expanded" }),
            ),
            column("sum", { groupShow: "collapsed" }),
        ],
    },
    { key: "h", name: "H", children: [column("h0"), column("h1")] },
    ...Array.from({ length: 20 }, (_, i) => column(`c${i}`)),
];

stubViewportSize(400, 235);

/** The root's props a test gives (the collapsed groups, their output's handler, the scroll's scale). */
interface GridProps {
    collapsedGroupKeys?: readonly string[];
    defaultCollapsedGroupKeys?: readonly string[];
    onCollapsedGroupKeysChange?: (keys: readonly string[]) => void;
    maxScrollSize?: number;
}

// A group's header cell holds its label and its toggle, as an app writes them (Vue's
// `GroupContent`): the label `[dataGridGroupLabel]`, the toggle running the model's command
// through the grid's ref; every part counts its renders (D9).
@Component({
    selector: "test-collapse-grid",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [columns]="columns" [rows]="rows" [rowHeight]="20" [overscan]="{ columns: 1 }"
            [collapsedGroupKeys]="props().collapsedGroupKeys" [defaultCollapsedGroupKeys]="props().defaultCollapsedGroupKeys"
            (collapsedGroupKeysChange)="props().onCollapsedGroupKeysChange?.($event)"
            [maxScrollSize]="props().maxScrollSize" [gridRef]="gridRef">
            @if (table()) {
                <table dataGridGrid>
                    <thead *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <tr [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <th [dataGridHeaderCell]="cell" #header="dataGridHeaderCell">{{ rendered("header-cell") }}@if (cell.group) {<span [dataGridGroupLabel]="cell">{{ rendered("label") }}{{ cell.group.name }}@if (header.state()?.collapsed !== undefined) {<button type="button" [attr.data-testid]="'toggle-' + cell.key" [attr.aria-expanded]="!header.state()?.collapsed" (click)="toggle(cell.key)">±</button>}</span>} @else {<ng-container *dataGridCellContent />}</th>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </thead>
                    <tbody dataGridBody>
                        <ng-template dataGridRows let-row>
                            <tr [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <td [dataGridCell]="cell">{{ rendered("cell") }}<ng-container *dataGridCellContent /></td>
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
                                    <div [dataGridHeaderCell]="cell" #header="dataGridHeaderCell">{{ rendered("header-cell") }}@if (cell.group) {<span [dataGridGroupLabel]="cell">{{ rendered("label") }}{{ cell.group.name }}@if (header.state()?.collapsed !== undefined) {<button type="button" [attr.data-testid]="'toggle-' + cell.key" [attr.aria-expanded]="!header.state()?.collapsed" (click)="toggle(cell.key)">±</button>}</span>} @else {<ng-container *dataGridCellContent />}</div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <div dataGridBody>
                        <ng-template dataGridRows let-row>
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell">{{ rendered("cell") }}<ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            }
        </div>
    `,
})
class CollapseGrid {
    readonly columns = COLUMNS;
    readonly rows = rows;
    readonly rendered = rendered;
    readonly gridRef = createDataGridRef<Row>();
    readonly props = input<GridProps>({});
    readonly table = input(false);

    toggle(groupKey: string) {
        this.gridRef.current?.model.run("column-groups.toggle", { groupKey });
    }
}

function grid(
    props: GridProps = {},
    table = false,
    setup?: (fixture: ComponentFixture<CollapseGrid>) => void,
) {
    return render(CollapseGrid, (fixture) => {
        fixture.componentRef.setInput("props", props);
        fixture.componentRef.setInput("table", table);
        setup?.(fixture);
    });
}

/** The columns' header cells' text, in order. */
function columnRow(container: HTMLElement): string[] {
    return [
        ...container.querySelectorAll(
            '[data-grid-part="header-cell"]:not([data-group])',
        ),
    ].map((cell) => cell.textContent ?? "");
}

function groupCell(container: HTMLElement, key: string): HTMLElement {
    const toggle = container.querySelector(`[data-testid="toggle-${key}"]`);
    const cell = toggle?.closest('[data-grid-part="header-cell"]');
    if (!(cell instanceof HTMLElement)) throw new Error(`no group ${key}`);
    return cell;
}

async function toggle(container: HTMLElement, key: string) {
    const button = container.querySelector(`[data-testid="toggle-${key}"]`);
    if (!(button instanceof HTMLElement)) throw new Error(`no toggle ${key}`);
    click(button);
    await settled();
}

for (const table of [false, true]) {
    describe(table ? "as a table" : "as divs", () => {
        it("toggles a group from the app's control, its header cell telling it", async () => {
            const onCollapsedGroupKeysChange = vi.fn();
            const { container } = await grid(
                { onCollapsedGroupKeysChange },
                table,
            );
            const g = groupCell(container, "g");
            expect(g).toHaveAttribute("data-collapsible", "");
            expect(g).not.toHaveAttribute("data-collapsed");
            expect(g).toHaveAttribute("aria-colspan", "6");
            expect(columnRow(container).slice(0, 3)).toEqual([
                "ID",
                "G0",
                "G1",
            ]);
            await toggle(container, "g");
            expect(onCollapsedGroupKeysChange).toHaveBeenCalledWith(["g"]);
            expect(g).toHaveAttribute("data-collapsed", "");
            expect(g).toHaveAttribute("aria-colspan", "2");
            if (table) expect(g).toHaveAttribute("colspan", "2");
            expect(columnRow(container).slice(0, 4)).toEqual([
                "ID",
                "G0",
                "SUM",
                "H0",
            ]);
            expect(cellAt(container, 0, 2)).toHaveTextContent("0sum");
            // a group that does not collapse says nothing
            const h = container.querySelector(
                '[data-grid-part="header-cell"][data-group][aria-colspan="2"]:not([data-collapsible])',
            );
            expect(h).toHaveTextContent("H");
        });
    });
}

describe("controlled or not", () => {
    it("starts collapsed, uncontrolled", async () => {
        const { container } = await grid({ defaultCollapsedGroupKeys: ["g"] });
        expect(groupCell(container, "g")).toHaveAttribute("data-collapsed");
        await toggle(container, "g");
        expect(groupCell(container, "g")).not.toHaveAttribute("data-collapsed");
    });

    it("asks a controlled parent, and follows its prop", async () => {
        const asked = vi.fn();
        const parent = (follow: boolean) => {
            const props = (keys: readonly string[]): GridProps => ({
                collapsedGroupKeys: keys,
                onCollapsedGroupKeysChange: (next) => {
                    asked(next);
                    if (follow) {
                        fixture?.componentRef.setInput("props", props(next));
                    }
                },
            });
            let fixture: ComponentFixture<CollapseGrid> | undefined;
            return grid(props([]), false, (created) => {
                fixture = created;
            });
        };
        const declined = await parent(false);
        await toggle(declined.container, "g");
        expect(asked).toHaveBeenLastCalledWith(["g"]);
        expect(groupCell(declined.container, "g")).not.toHaveAttribute(
            "data-collapsed",
        );
        declined.fixture.destroy();
        const followed = await parent(true);
        await toggle(followed.container, "g");
        expect(groupCell(followed.container, "g")).toHaveAttribute(
            "data-collapsed",
        );
    });

    it("takes the same keys in another order as no change", async () => {
        const onCollapsedGroupKeysChange = vi.fn();
        const { container, fixture } = await grid({
            collapsedGroupKeys: ["g", "gone"],
            onCollapsedGroupKeysChange,
        });
        fixture.componentRef.setInput("props", {
            collapsedGroupKeys: ["gone", "g"],
            onCollapsedGroupKeysChange,
        } satisfies GridProps);
        await settled(fixture);
        expect(onCollapsedGroupKeysChange).not.toHaveBeenCalled();
        expect(groupCell(container, "g")).toHaveAttribute("data-collapsed");
    });
});

describe("a group's label", () => {
    function label(container: HTMLElement): HTMLElement {
        const element = container.querySelector(
            '[data-grid-part="group-label"][data-grid-group-label="g"]',
        );
        if (!(element instanceof HTMLElement)) throw new Error("no label");
        return element;
    }

    it("is sticky, marked with its group's key, its inset the engine's", async () => {
        const { container } = await grid();
        const element = label(container);
        expect(element.style.position).toBe("sticky");
        expect(element.style.left).toBe("0px");
    });

    it("stays at the view's start through a scroll, Angular rendering nothing", async () => {
        const { container } = await grid();
        const viewport = root(container);
        scrollRoot(viewport, { left: 300 });
        await settled();
        const at = label(container).style.left;
        resetRenders();
        // inside the overscan: no render, and the label's inset holds (sticky keeps it in place)
        for (const left of [310, 330, 350]) scrollRoot(viewport, { left });
        await settled();
        expect(renders()).toBe(0);
        expect(label(container).style.left).toBe(at);
    });

    it("follows every frame under scaled column scroll, Angular rendering nothing", async () => {
        const { container } = await grid({ maxScrollSize: 1_200 });
        const viewport = root(container);
        // 2,800px in 1,200: "g" (100–700) scrolled partly out
        scrollRoot(viewport, { left: 100 });
        await settled();
        resetRenders();
        const insets = new Set<string>();
        for (const left of [101, 102, 103]) {
            scrollRoot(viewport, { left });
            insets.add(label(container).style.left);
        }
        await settled();
        expect(renders()).toBe(0);
        expect(insets.size).toBe(3);
    });
});
