import {
    ChangeDetectionStrategy,
    Component,
    input,
    signal,
} from "@angular/core";
import { describe, expect, it } from "vitest";
import {
    DataGridLocalRows,
    injectLocalRows,
    type LocalRowsResult,
} from "../src/local";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
    type SortColumn,
} from "../src/public-api";
import { click, headerAt, render, settled, stubViewportSize } from "./helpers";

// One injection function for rows in memory (Epic #47, L1): its props given to the root
// (`[dataGridLocalRows]`) make the header sort the rows, and its controls filter, search and page
// what the grid shows.

interface Person {
    id: number;
    name: string;
    age: number;
    team: string;
}

const people: Person[] = [
    { id: 1, name: "Carla", age: 41, team: "Core" },
    { id: 2, name: "Ana", age: 29, team: "Design" },
    { id: 3, name: "Bruno", age: 35, team: "Core" },
    { id: 4, name: "Davi", age: 23, team: "Growth" },
    { id: 5, name: "Élodie", age: 35, team: "Design" },
];

const columns: Column<Person, DataGridNode>[] = [
    { key: "name", name: "Name", width: 120, sortable: true },
    { key: "age", name: "Age", width: 80, sortable: true },
    { key: "team", name: "Team", width: 120 },
];

stubViewportSize(400, 400);

let latest: LocalRowsResult<Person> | undefined;

/** The grid's parts as divs: a header and a body, every cell with its default content. */
const DIVS = `
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
`;

/** The same parts as a table. */
const TABLE = `
    <table dataGridGrid>
        <thead *dataGridHeader>
            <ng-template dataGridHeaderRows let-row>
                <tr [dataGridHeaderRow]="row">
                    <ng-template dataGridHeaderCells let-cell>
                        <th [dataGridHeaderCell]="cell"><ng-container *dataGridCellContent /></th>
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
`;

@Component({
    imports: [DATA_GRID, DataGridLocalRows],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [columns]="columns" [rowHeight]="20" [dataGridLocalRows]="local">
            @if (table()) { ${TABLE} } @else { ${DIVS} }
        </div>
    `,
})
class People {
    readonly rows = input<readonly Person[]>(people);
    readonly pageSize = input<number | undefined>(undefined);
    readonly table = input(false);
    readonly columns = columns;
    readonly local = injectLocalRows(this.rows, columns, () => ({
        pageSize: this.pageSize(),
    }));

    constructor() {
        latest = this.local;
    }
}

/** The names the grid renders, in order. */
function names(container: HTMLElement): string[] {
    return [
        ...container.querySelectorAll(
            '[data-grid-part="cell"][data-column-index="0"]',
        ),
    ].map((cell) => cell.textContent ?? "");
}

/** The button whose text is `text`. */
function button(container: HTMLElement, text: string): HTMLElement {
    const found = [...container.querySelectorAll("button")].find(
        (element) => element.textContent === text,
    );
    if (!found) throw new Error(`no ${text} button`);
    return found;
}

for (const table of [false, true]) {
    describe(`injectLocalRows, as ${table ? "a table" : "divs"}`, () => {
        it("sorts the rows when the header is clicked, through the root's props", async () => {
            const { container } = await render(People, (fixture) =>
                fixture.componentRef.setInput("table", table),
            );
            expect(names(container)).toEqual(people.map((row) => row.name));
            click(headerAt(container, 0));
            await settled();
            expect(names(container)).toEqual([
                "Ana",
                "Bruno",
                "Carla",
                "Davi",
                "Élodie",
            ]);
            expect(headerAt(container, 0)).toHaveAttribute(
                "aria-sort",
                "ascending",
            );
            click(headerAt(container, 1));
            await settled();
            expect(names(container)).toEqual([
                "Davi",
                "Ana",
                "Bruno",
                "Élodie",
                "Carla",
            ]);
            click(headerAt(container, 1));
            await settled();
            expect(names(container)[0]).toBe("Carla");
            expect(latest?.sort.columns).toEqual([
                { columnKey: "age", direction: "descending" },
            ]);
        });

        it("filters, searches and pages what the grid shows, back to the first page on a filter", async () => {
            const { container } = await render(People, (fixture) => {
                fixture.componentRef.setInput("table", table);
                fixture.componentRef.setInput("pageSize", 2);
            });
            expect(names(container)).toEqual(["Carla", "Ana"]);
            expect(latest?.page).toMatchObject({
                index: 0,
                count: 3,
                canNext: true,
            });
            latest?.page.next();
            await settled();
            expect(names(container)).toEqual(["Bruno", "Davi"]);
            latest?.page.last();
            await settled();
            expect(names(container)).toEqual(["Élodie"]);
            expect(latest?.page.canNext).toBe(false);
            latest?.filter.set("team", ["Core", "Design"]);
            await settled();
            expect(latest?.page.index).toBe(0);
            expect(latest?.filteredCount).toBe(4);
            expect(names(container)).toEqual(["Carla", "Ana"]);
            latest?.filter.setSearch("elo");
            await settled();
            expect(names(container)).toEqual(["Élodie"]);
            expect(latest).toMatchObject({ total: 5, filteredCount: 1 });
            latest?.filter.clear();
            latest?.filter.setSearch("");
            latest?.page.setSize(undefined);
            await settled();
            expect(names(container)).toHaveLength(5);
        });
    });
}

describe("injectLocalRows across renders", () => {
    it("keeps the sort, the filters and the page (inside the pages left) when the rows change", async () => {
        @Component({
            imports: [DATA_GRID, DataGridLocalRows],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <button type="button" (click)="rows.set(rows().slice(0, 3))">delete</button>
                <button type="button" (click)="rows.set(all)">restore</button>
                <div dataGridRoot [columns]="columns" [dataGridLocalRows]="local">
                    <div dataGridGrid>
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
                </div>
            `,
        })
        class Deleting {
            readonly all = people;
            readonly columns = columns;
            readonly rows = signal<readonly Person[]>(people);
            readonly local = injectLocalRows(this.rows, columns, {
                pageSize: 2,
                defaultSortColumns: [
                    { columnKey: "name", direction: "ascending" },
                ],
            });

            constructor() {
                latest = this.local;
            }
        }
        const { container } = await render(Deleting);
        latest?.page.last();
        await settled();
        expect(names(container)).toEqual(["Élodie"]);
        click(button(container, "delete"));
        await settled();
        // Carla, Ana, Bruno left: sorted, on the last page there is
        expect(latest?.page).toMatchObject({ index: 1, count: 2 });
        expect(names(container)).toEqual(["Carla"]);
        // the page shown is the page: rows growing back leave the view there
        click(button(container, "restore"));
        await settled();
        expect(latest?.page).toMatchObject({ index: 1, count: 3 });
        expect(latest?.sort.columns).toEqual([
            { columnKey: "name", direction: "ascending" },
        ]);
    });

    it("follows a new pageSize", async () => {
        const { container, fixture } = await render(People, (created) =>
            created.componentRef.setInput("pageSize", 2),
        );
        expect(names(container)).toHaveLength(2);
        fixture.componentRef.setInput("pageSize", 4);
        await settled(fixture);
        expect(latest?.page).toMatchObject({ size: 4, count: 2 });
        expect(names(container)).toHaveLength(4);
    });

    it("hands the grid the same onSortColumnsChange on every render", async () => {
        const seen = new Set<(sortColumns: readonly SortColumn[]) => void>();
        let renders = 0;
        @Component({
            imports: [DATA_GRID, DataGridLocalRows],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                {{ see() }}
                <div dataGridRoot [columns]="columns" [dataGridLocalRows]="local">
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
                    </div>
                </div>
            `,
        })
        class Watch {
            readonly columns = columns;
            readonly local = injectLocalRows(people, columns);
            // the template reads the props: a new sort renders it again
            see() {
                renders += 1;
                seen.add(this.local.props.onSortColumnsChange);
                return "";
            }
        }
        const { container } = await render(Watch);
        click(headerAt(container, 0));
        await settled();
        click(headerAt(container, 1));
        await settled();
        // rendered again on each sort, the same handler every time
        expect(renders).toBeGreaterThan(1);
        expect(seen.size).toBe(1);
    });
});
