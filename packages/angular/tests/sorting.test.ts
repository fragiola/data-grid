import {
    ChangeDetectionStrategy,
    Component,
    input,
    signal,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import { DataGridLocalRows, injectLocalRows } from "../src/local";
import {
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type DataGridRef,
} from "../src/public-api";
import { DataGridSorting, type SortColumn, sorting } from "../src/sorting";
import { type TestProps, TestRootProps } from "./grid";
import {
    click,
    headerAt,
    keyDown,
    render,
    settled,
    stubViewportSize,
} from "./helpers";

// Sorting (Epic #27): `sortable` columns, the sort controlled or not like the active position
// (S5), toggled by a click, Enter or Space on a header cell after the consumer's handlers (S4),
// shown through aria-sort and data-* (S6). The grid never orders the rows (S7). A feature since
// Epic #141: the root installs it (`[features]`), its inputs on `[dataGridSorting]`.

interface Person {
    id: number;
    name: string;
    age: number;
}

const people: Person[] = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
    age: 20 + (i % 7),
}));

// Vue's "Id" header renders "Id " and a button through renderHeaderCell; in Angular the button
// is the app's markup in its header cell template (`menu` lists the cells that get one)
const columns: Column<Person, DataGridNode>[] = [
    { key: "name", name: "Name", width: 150, sortable: true },
    { key: "age", name: "Age", width: 80, sortable: true },
    { key: "id", name: "Id", width: 80 },
];

stubViewportSize(400, 235);

const FEATURES = [sorting()] as const;

/** Where a consumer's click listener cancels the grid's. */
type Prevent = "root" | "header-cell" | null;

/** The sorting grid: its root's props whole, a menu button in some header cells, a gridRef. */
@Component({
    selector: "sort-grid",
    imports: [DATA_GRID, TestRootProps],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [columns]="props().columns" [testProps]="props()" [gridRef]="gridRef()"
            (click)="onClick('root', $event)">
            @if (table()) {
                <table dataGridGrid>
                    <thead *dataGridHeader>
                        <ng-template dataGridHeaderRows let-row>
                            <tr [dataGridHeaderRow]="row">
                                <ng-template dataGridHeaderCells let-cell>
                                    <th [dataGridHeaderCell]="cell" (click)="onClick('header-cell', $event)"><ng-container *dataGridCellContent />@if (menu().includes(cell.key)) { <button type="button">menu</button> }</th>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </thead>
                    <tbody dataGridBody>
                        <ng-template dataGridRows let-row>
                            <tr [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <td [dataGridCell]="cell"><ng-container *dataGridCellContent /></td>
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
                                    <div [dataGridHeaderCell]="cell" (click)="onClick('header-cell', $event)"><ng-container *dataGridCellContent />@if (menu().includes(cell.key)) { <button type="button">menu</button> }</div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <div dataGridBody>
                        <ng-template dataGridRows let-row>
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell"><ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            }
        </div>
    `,
})
class SortGrid {
    readonly props = input.required<TestProps<unknown>>();
    readonly table = input(false);
    readonly menu = input<readonly string[]>(["id"]);
    readonly gridRef = input<DataGridRef | undefined>(undefined);
    readonly prevent = input<Prevent>(null);

    onClick(where: Prevent, event: MouseEvent) {
        if (where === this.prevent()) event.preventDefault();
    }
}

type GridProps = Partial<TestProps<Person, typeof FEATURES>> & {
    table?: boolean;
    menu?: readonly string[];
    gridRef?: DataGridRef;
    prevent?: Prevent;
};

/** Gives the grid `props`: the root's whole, and the test component's own inputs. */
function setInputs(fixture: ComponentFixture<SortGrid>, props: GridProps) {
    const {
        table = false,
        menu = ["id"],
        gridRef,
        prevent = null,
        ...rest
    } = props;
    const inputs = {
        props: {
            columns,
            rows: people,
            rowHeight: 20,
            features: FEATURES,
            ...rest,
        },
        table,
        menu,
        gridRef,
        prevent,
    };
    for (const [name, value] of Object.entries(inputs)) {
        fixture.componentRef.setInput(name, value);
    }
}

/** Mounts the grid with `props`; `update` gives it new ones (a parent rendering again). */
async function mountGrid(props: GridProps = {}) {
    const view = await render(SortGrid, (fixture) => setInputs(fixture, props));
    return {
        ...view,
        update: async (next: GridProps) => {
            setInputs(view.fixture, next);
            await settled(view.fixture);
        },
    };
}

/** Each header cell's sort, as its attributes show it. */
function shown(container: HTMLElement) {
    return [0, 1, 2].map((columnIndex) => {
        const cell = headerAt(container, columnIndex);
        return [
            cell.getAttribute("aria-sort"),
            cell.getAttribute("data-sort"),
            cell.getAttribute("data-sort-priority"),
            cell.hasAttribute("data-sortable"),
        ];
    });
}

describe("uncontrolled", () => {
    it("toggles on a click, tells the change, and shows it", async () => {
        const onSortColumnsChange = vi.fn();
        const { container } = await mountGrid({ onSortColumnsChange });
        expect(shown(container)).toEqual([
            [null, null, null, true],
            [null, null, null, true],
            [null, null, null, false],
        ]);
        click(headerAt(container, 0));
        await settled();
        expect(onSortColumnsChange).toHaveBeenLastCalledWith([
            { columnKey: "name", direction: "ascending" },
        ]);
        expect(shown(container)[0]).toEqual([
            "ascending",
            "ascending",
            "1",
            true,
        ]);
        click(headerAt(container, 0));
        await settled();
        expect(shown(container)[0]).toEqual([
            "descending",
            "descending",
            "1",
            true,
        ]);
    });

    it("adds a column with Ctrl, aria-sort staying on the first one", async () => {
        const { container } = await mountGrid({
            defaultSortColumns: [{ columnKey: "age", direction: "descending" }],
        });
        click(headerAt(container, 0), { ctrlKey: true });
        await settled();
        expect(shown(container)).toEqual([
            [null, "ascending", "2", true],
            ["descending", "descending", "1", true],
            [null, null, null, false],
        ]);
    });

    it("toggles on Enter and Space on the active header cell", async () => {
        const { container } = await mountGrid();
        const name = headerAt(container, 0);
        name.focus();
        await settled();
        keyDown(name, { key: "Enter" });
        await settled();
        expect(shown(container)[0]?.[1]).toBe("ascending");
        keyDown(headerAt(container, 0), { key: " " });
        await settled();
        expect(shown(container)[0]?.[1]).toBe("descending");
    });

    it("tells the app when its starting sort names a column that is not sortable", async () => {
        const onSortColumnsChange = vi.fn();
        await mountGrid({
            defaultSortColumns: [
                { columnKey: "id", direction: "ascending" },
                { columnKey: "age", direction: "descending" },
            ],
            onSortColumnsChange,
        });
        expect(onSortColumnsChange).toHaveBeenCalledTimes(1);
        expect(onSortColumnsChange).toHaveBeenCalledWith([
            { columnKey: "age", direction: "descending" },
        ]);
    });

    it("leaves a control inside a header cell its own clicks", async () => {
        const onSortColumnsChange = vi.fn();
        const { container } = await mountGrid({
            columns: [{ key: "name", width: 150, sortable: true }],
            menu: ["name"],
            onSortColumnsChange,
        });
        const button = headerAt(container, 0).querySelector("button");
        if (!button) throw new Error("no button");
        click(button);
        await settled();
        expect(onSortColumnsChange).not.toHaveBeenCalled();
    });
});

describe("controlled", () => {
    it("asks on a click, and shows the sort only when the prop follows", async () => {
        const onSortColumnsChange = vi.fn();
        const { container, update } = await mountGrid({
            sortColumns: [],
            onSortColumnsChange,
        });
        click(headerAt(container, 1));
        await settled();
        expect(onSortColumnsChange).toHaveBeenCalledWith([
            { columnKey: "age", direction: "ascending" },
        ]);
        expect(shown(container)[1]?.[1]).toBeNull();
        await update({
            sortColumns: [{ columnKey: "age", direction: "ascending" }],
            onSortColumnsChange,
        });
        expect(shown(container)[1]?.[1]).toBe("ascending");
        expect(onSortColumnsChange).toHaveBeenCalledTimes(1);
    });

    it("works with a parent that follows", async () => {
        // a parent: the sort in its state, bound both ways
        @Component({
            imports: [DATA_GRID, DataGridSorting],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [features]="features"
                    dataGridSorting [(sortColumns)]="sortColumns">
                    <div dataGridGrid>
                        <div *dataGridHeader>
                            <ng-template dataGridHeaderRows let-row>
                                <div [dataGridHeaderRow]="row">
                                    <ng-template dataGridHeaderCells let-cell>
                                        <div [dataGridHeaderCell]="cell"><ng-container *dataGridCellContent /></div>
                                    </ng-template>
                                </div>
                            </ng-template>
                        </div>
                        <div dataGridBody></div>
                    </div>
                </div>
            `,
        })
        class Following {
            readonly features = FEATURES;
            readonly rows = people;
            readonly columns = columns;
            readonly sortColumns = signal<readonly SortColumn[]>([]);
        }
        const { container } = await render(Following);
        click(headerAt(container, 0));
        await settled();
        click(headerAt(container, 1), { metaKey: true });
        await settled();
        expect(shown(container)).toEqual([
            ["ascending", "ascending", "1", true],
            [null, "ascending", "2", true],
            [null, null, null, false],
        ]);
    });

    it("keeps what it can of a prop naming a column that is not sortable, at mount or later", async () => {
        const onSortColumnsChange = vi.fn();
        const mixed: SortColumn[] = [
            { columnKey: "name", direction: "ascending" },
            { columnKey: "id", direction: "ascending" },
        ];
        const { container, update } = await mountGrid({
            sortColumns: [],
            onSortColumnsChange,
        });
        await update({ sortColumns: mixed, onSortColumnsChange });
        expect(shown(container)[0]?.[1]).toBe("ascending");
        expect(onSortColumnsChange).toHaveBeenLastCalledWith([
            { columnKey: "name", direction: "ascending" },
        ]);
    });

    it("tells the parent when the columns drop a sorted column", async () => {
        const onSortColumnsChange = vi.fn();
        const sortColumns: SortColumn[] = [
            { columnKey: "name", direction: "ascending" },
            { columnKey: "age", direction: "descending" },
        ];
        const { update } = await mountGrid({
            sortColumns,
            onSortColumnsChange,
        });
        expect(onSortColumnsChange).not.toHaveBeenCalled();
        await update({
            columns: [
                { key: "name", width: 150 },
                { key: "age", width: 80, sortable: true },
            ],
            sortColumns,
            onSortColumnsChange,
        });
        expect(onSortColumnsChange).toHaveBeenLastCalledWith([
            { columnKey: "age", direction: "descending" },
        ]);
    });
});

describe("the model", () => {
    it("drives the same state: sort-columns.set through a gridRef asks or tells", async () => {
        const onSortColumnsChange = vi.fn();
        const gridRef = createDataGridRef<unknown, typeof FEATURES>();
        const set = async () => {
            gridRef.current?.model.run("sort-columns.set", {
                sortColumns: [{ columnKey: "age", direction: "descending" }],
            });
            await settled();
        };
        const { container, update } = await mountGrid({
            gridRef,
            onSortColumnsChange,
        });
        await set();
        expect(onSortColumnsChange).toHaveBeenCalledTimes(1);
        expect(shown(container)[1]?.[1]).toBe("descending");
        await update({ gridRef, sortColumns: [], onSortColumnsChange });
        // controlled to none: the prop wins over what the model held
        expect(shown(container)[1]?.[1]).toBeNull();
        await set();
        expect(onSortColumnsChange).toHaveBeenCalledTimes(2);
        expect(shown(container)[1]?.[1]).toBeNull();
    });
});

describe("cancelling", () => {
    // Vue's third case, the consumer's element in the root's `render` slot, has no Angular form:
    // the root directive is on the app's own element, which is the root case
    it("a consumer's preventDefault on the header cell or the root cancels", async () => {
        const onSortColumnsChange = vi.fn();
        const views = [
            await mountGrid({ prevent: "root", onSortColumnsChange }),
            // on the header cell itself: its own (click) runs first (bubbling)
            await mountGrid({ prevent: "header-cell", onSortColumnsChange }),
        ];
        for (const { container } of views) {
            click(headerAt(container, 0));
        }
        await settled();
        expect(onSortColumnsChange).not.toHaveBeenCalled();
    });
});

describe("structure", () => {
    it("puts aria-sort on a th as a table", async () => {
        const { container } = await mountGrid({
            table: true,
            defaultSortColumns: [
                { columnKey: "name", direction: "descending" },
            ],
        });
        const th = headerAt(container, 0);
        expect(th.tagName).toBe("TH");
        expect(th).toHaveAttribute("aria-sort", "descending");
    });

    it("adds no attribute to a grid without sortable columns", async () => {
        const { container } = await mountGrid({
            columns: columns.map(({ sortable: _, ...column }) => column),
        });
        const sortAttributes = [
            ...container.querySelectorAll(
                "[aria-sort], [data-sortable], [data-sort], [data-sort-priority]",
            ),
        ];
        expect(sortAttributes).toHaveLength(0);
    });
});

/** A header row only: the parts sorting reads. */
const HEADER = `
    <div dataGridGrid>
        <div *dataGridHeader>
            <ng-template dataGridHeaderRows let-row>
                <div [dataGridHeaderRow]="row">
                    <ng-template dataGridHeaderCells let-cell>
                        <div [dataGridHeaderCell]="cell"><ng-container *dataGridCellContent /></div>
                    </ng-template>
                </div>
            </ng-template>
        </div>
        <div dataGridBody></div>
    </div>
`;

describe("[features] and [dataGridSorting]", () => {
    it("starts from defaultSortColumns and tells the change through sortColumnsChange", async () => {
        const changes: (readonly SortColumn[])[] = [];
        @Component({
            imports: [DATA_GRID, DataGridSorting],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [features]="features"
                    dataGridSorting [defaultSortColumns]="start" (sortColumnsChange)="changed($event)">${HEADER}</div>
            `,
        })
        class Uncontrolled {
            readonly features = FEATURES;
            readonly rows = people;
            readonly columns = columns;
            readonly start: readonly SortColumn[] = [
                { columnKey: "age", direction: "descending" },
            ];
            changed(sort: readonly SortColumn[]) {
                changes.push(sort);
            }
        }
        const { container } = await render(Uncontrolled);
        expect(shown(container)[1]?.[1]).toBe("descending");
        click(headerAt(container, 1));
        await settled();
        expect(changes).toEqual([[]]);
        expect(shown(container)[1]?.[1]).toBeNull();
    });

    it("sorts nothing without sorting() installed: its inputs are not read", async () => {
        const changed = vi.fn();
        @Component({
            imports: [DATA_GRID, DataGridSorting],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20"
                    dataGridSorting [defaultSortColumns]="start" (sortColumnsChange)="changed($event)">${HEADER}</div>
            `,
        })
        class Bare {
            readonly rows = people;
            readonly columns = columns;
            readonly start: readonly SortColumn[] = [
                { columnKey: "age", direction: "descending" },
            ];
            readonly changed = changed;
        }
        const { container } = await render(Bare);
        click(headerAt(container, 0));
        await settled();
        expect(changed).not.toHaveBeenCalled();
        expect(
            container.querySelectorAll(
                "[aria-sort], [data-sortable], [data-sort]",
            ),
        ).toHaveLength(0);
    });

    it("keeps the features it was created with, and tells a later list once", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [features]="features()">${HEADER}</div>
            `,
        })
        class Changing {
            readonly features =
                signal<readonly ReturnType<typeof sorting>[]>(FEATURES);
            readonly rows = people;
            readonly columns = columns;
        }
        const { container, fixture } = await render(Changing);
        fixture.componentInstance.features.set([]);
        await settled(fixture);
        fixture.componentInstance.features.set([]);
        await settled(fixture);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining("`features` changed"),
        );
        click(headerAt(container, 0));
        await settled();
        expect(shown(container)[0]?.[1]).toBe("ascending");
        warn.mockRestore();
    });

    it("gives way to [dataGridLocalRows], whose sort wins over the root's inputs", async () => {
        @Component({
            imports: [DATA_GRID, DataGridSorting, DataGridLocalRows],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [columns]="columns" [rowHeight]="20" [features]="features"
                    dataGridSorting [sortColumns]="ignored" [dataGridLocalRows]="local">${HEADER}</div>
            `,
        })
        class Local {
            readonly features = FEATURES;
            readonly columns = columns;
            readonly ignored: readonly SortColumn[] = [
                { columnKey: "age", direction: "descending" },
            ];
            readonly local = injectLocalRows(people, columns, {
                defaultSortColumns: [
                    { columnKey: "name", direction: "ascending" },
                ],
            });
        }
        const { container } = await render(Local);
        expect(shown(container)[0]?.[1]).toBe("ascending");
        expect(shown(container)[1]?.[1]).toBeNull();
    });
});
