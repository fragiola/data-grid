import {
    ChangeDetectionStrategy,
    Component,
    InjectionToken,
    inject,
    signal,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import {
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type DataGridRef,
    injectColumnWindow,
    injectDataGrid,
    injectRowWindow,
} from "../src/public-api";
import {
    click,
    render,
    rendered,
    rendersOf,
    resetRenders,
    root,
    scrollRoot,
    settled,
    stubViewportSize,
} from "./helpers";

// A grid reached from outside its root (Epic #23, R2): `gridRef` holds the root's model and
// engine, and the injection functions that take it follow the grid from anywhere. jsdom lays
// nothing out: the viewport's size is faked on the root element (400 × 235: a 35px header, then
// 10 rows of 20). An injection function takes its `gridRef` at construction, so the app provides
// its ref (the token below) to the components it renders, as a Vue app passes it as a prop.

interface Person {
    id: number;
    name: string;
}

const people: Person[] = Array.from({ length: 1_000 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
}));

const columns: Column<Person, DataGridNode>[] = [
    { key: "name", name: "Name", width: 200 },
    { key: "id", name: "Id", width: 100 },
];

stubViewportSize(400, 235);

/** The app's ref, provided to the components it renders. */
const GRID_REF = new InjectionToken<DataGridRef<Person>>("test grid ref");

/** The grid's parts inside a root: a header and a body, every cell with its default content. */
const PARTS = `
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

/** Shows the rows in view, from outside the grid; counts its own renders ("status"). */
@Component({
    selector: "test-status",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<output data-testid="status">{{ count() }}{{ rows().visible.start }}–{{ rows().visible.end }} × {{ columnWindow().visible.end }}</output>`,
})
class StatusBar {
    private readonly gridRef = inject(GRID_REF);
    readonly rows = injectRowWindow(this.gridRef);
    readonly columnWindow = injectColumnWindow(this.gridRef);
    count() {
        return rendered("status");
    }
}

const status = (container: ParentNode) =>
    container.querySelector('[data-testid="status"]');

async function scroll(element: HTMLElement, top: number) {
    scrollRoot(element, { top });
    await settled();
}

/** The ref the last app made, handed out for the test. */
let latestRef: DataGridRef<Person> | undefined;

/** Makes the app's ref, and hands it out. */
function appRef(): DataGridRef<Person> {
    const gridRef = createDataGridRef<Person>();
    latestRef = gridRef;
    return gridRef;
}

/** The app owning the ref: the grid, and nothing else; its renders counted ("app"). */
@Component({
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: GRID_REF, useFactory: appRef }],
    template: `{{ count() }}<div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [gridRef]="gridRef">${PARTS}</div>`,
})
class App {
    readonly gridRef = inject(GRID_REF);
    readonly rows = people;
    readonly columns = columns;
    count() {
        return rendered("app");
    }
}

/** The app with a status bar rendered before the root. */
@Component({
    imports: [DATA_GRID, StatusBar],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: GRID_REF, useFactory: appRef }],
    template: `{{ count() }}<test-status /><div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [gridRef]="gridRef">${PARTS}</div>`,
})
class AppWithStatus {
    readonly gridRef = inject(GRID_REF);
    readonly rows = people;
    readonly columns = columns;
    count() {
        return rendered("app");
    }
}

describe("gridRef", () => {
    it("holds the root's model and engine while it is mounted, and null after", async () => {
        const { fixture } = await render(App);
        const gridRef = latestRef;
        const current = gridRef?.current;
        expect(current?.model.get("row-count")).toBe(1_000);
        expect(current?.engine.get("row-window").visible).toEqual({
            start: 0,
            end: 10,
        });
        fixture.destroy();
        expect(gridRef?.current).toBeNull();
    });

    it("is the same object across renders", async () => {
        const refs = new Set<DataGridRef<Person>>();
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `{{ hold(tick()) }}<div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [gridRef]="gridRef">${PARTS}</div>`,
        })
        class Ticking {
            readonly gridRef = createDataGridRef<Person>();
            readonly rows = people;
            readonly columns = columns;
            // the template reads `tick`: a new one renders the app again
            readonly tick = signal(0);
            hold(_tick: number) {
                refs.add(this.gridRef);
                return "";
            }
        }
        resetRenders();
        const { component, fixture } = await render(Ticking);
        component.tick.update((n) => n + 1);
        await settled(fixture);
        expect(refs.size).toBe(1);
    });

    it("updates a component rendered before the root once the root takes it", async () => {
        const { container } = await render(AppWithStatus);
        expect(status(container)).toHaveTextContent("0–10 × 2");
        await scroll(root(container), 100);
        expect(status(container)).toHaveTextContent("5–15 × 2");
    });

    it("re-renders the component reading a window, never the one rendering the root", async () => {
        const { container } = await render(AppWithStatus);
        resetRenders();
        await scroll(root(container), 20); // one row down: inside the overscan
        expect(rendersOf("status")).toBe(1);
        await scroll(root(container), 400); // twenty rows down: a new rendered window
        expect(rendersOf("status")).toBe(2);
        expect(rendersOf("app")).toBe(0);
        await scroll(root(container), 400); // where it is: nothing
        expect(rendersOf("status")).toBe(2);
    });

    // React's StrictMode (double effects) has no Angular counterpart: the live grid, driven
    it("drives the live grid under StrictMode", async () => {
        const { container } = await render(AppWithStatus);
        latestRef?.current?.model.run("active-position.set", {
            rowIndex: 2,
            columnIndex: 1,
        });
        await settled();
        const active = container.querySelector(
            '[data-grid-part="cell"][data-active]',
        );
        expect(active).toHaveAttribute("data-row-index", "2");
        await scroll(root(container), 100);
        expect(status(container)).toHaveTextContent("5–15");
    });

    it("follows a remounted root", async () => {
        @Component({
            imports: [DATA_GRID, StatusBar],
            changeDetection: ChangeDetectionStrategy.OnPush,
            providers: [{ provide: GRID_REF, useFactory: appRef }],
            template: `
                <test-status />
                <button type="button" (click)="remount()">remount</button>
                @for (key of keys(); track key) {
                    <div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [gridRef]="gridRef">${PARTS}</div>
                }
            `,
        })
        class Remounting {
            readonly gridRef = inject(GRID_REF);
            readonly rows = people;
            readonly columns = columns;
            readonly keys = signal([0]);
            remount() {
                this.keys.update(([key = 0]) => [key + 1]);
            }
        }
        const { container } = await render(Remounting);
        const gridRef = latestRef;
        const first = gridRef?.current;
        await scroll(root(container), 100);
        expect(status(container)).toHaveTextContent("5–15");
        const button = container.querySelector("button");
        if (!button) throw new Error("no button");
        click(button);
        await settled();
        expect(gridRef?.current).not.toBeNull();
        expect(gridRef?.current).not.toBe(first);
        // the new root starts at the top, and the status bar follows it
        expect(status(container)).toHaveTextContent("0–10");
        await scroll(root(container), 200);
        expect(status(container)).toHaveTextContent("10–20");
    });

    it("belongs to one mounted root: a second one is told in the console and does not take it", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [gridRef]="gridRef">${PARTS}</div>
                <div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [gridRef]="gridRef">${PARTS}</div>
            `,
        })
        class Twice {
            readonly gridRef = createDataGridRef<Person>();
            readonly rows = people;
            readonly columns = columns;
        }
        const { container, component } = await render(Twice);
        const { gridRef } = component;
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining("already held"),
        );
        // the first root keeps it, and both grids still work
        const [first] = container.querySelectorAll('[data-grid-part="root"]');
        expect(gridRef.current?.engine.adapter.getView().rowCount).toBe(1_000);
        gridRef.current?.model.run("active-position.set", {
            rowIndex: 1,
            columnIndex: 0,
        });
        await settled();
        expect(first?.querySelector("[data-active]")).not.toBeNull();
        expect(
            container.querySelectorAll('[data-grid-part="cell"][data-active]'),
        ).toHaveLength(1);
        error.mockRestore();
    });

    it("can be made outside a component, and refuses one it did not make", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const made = createDataGridRef<Person>();
        const fake: DataGridRef<Person> = {
            current: null,
            subscribe: () => () => {},
        };
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `<div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [gridRef]="gridRef">${PARTS}</div>`,
        })
        class Given {
            gridRef: DataGridRef<Person> = made;
            readonly rows = people;
            readonly columns = columns;
        }
        const { fixture } = await render(Given);
        expect(made.current?.model.get("row-count")).toBe(1_000);
        fixture.destroy();
        expect(made.current).toBeNull();
        await render(Given, (created) => {
            created.componentInstance.gridRef = fake;
        });
        // the core's message names the React and Vue hook beside createDataGridRef()
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining("createDataGridRef()"),
        );
        error.mockRestore();
    });

    it("renders rows that arrive through rows.changed, with the same getRow", async () => {
        const loaded = new Map<number, Person>();
        const arrive = (start: number, end: number) => {
            for (const person of people.slice(start, end)) {
                loaded.set(person.id, person);
            }
        };
        @Component({
            imports: [DATA_GRID],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `<div dataGridRoot [rowCount]="rowCount" [getRow]="getRow" [columns]="columns" [rowHeight]="20" [gridRef]="gridRef">${PARTS}</div>`,
        })
        class Loading {
            readonly gridRef = createDataGridRef<Person>();
            readonly rowCount = people.length;
            readonly getRow = (index: number) => loaded.get(index);
            readonly columns = columns;
        }
        const { container, component } = await render(Loading);
        const { gridRef } = component;
        const loading = () =>
            container.querySelectorAll('[data-grid-part="row"][data-loading]')
                .length;
        expect(loading()).toBe(14);
        // rows far out of view arrive: nothing on screen changes
        arrive(500, 520);
        gridRef.current?.model.run("rows.changed", { start: 500, end: 520 });
        await settled();
        expect(loading()).toBe(14);
        // the first rows arrive
        arrive(0, 14);
        gridRef.current?.model.run("rows.changed", { start: 0, end: 14 });
        await settled();
        expect(loading()).toBe(0);
        expect(container).toHaveTextContent("Person 3");
    });
});

describe("injection functions outside the root", () => {
    it("injectDataGrid(gridRef) is null until a root takes the ref, then its grid", async () => {
        const seen: (string | null)[] = [];
        @Component({
            selector: "test-reader",
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `{{ see() }}`,
        })
        class Reader {
            private readonly held = injectDataGrid(inject(GRID_REF));
            see() {
                const current = this.held();
                seen.push(
                    current ? `rows ${current.model.get("row-count")}` : null,
                );
                return "";
            }
        }
        @Component({
            imports: [DATA_GRID, Reader],
            changeDetection: ChangeDetectionStrategy.OnPush,
            providers: [{ provide: GRID_REF, useFactory: appRef }],
            template: `
                <test-reader />
                <button type="button" (click)="shown.set(true)">show</button>
                @if (shown()) {
                    <div dataGridRoot [rows]="rows" [columns]="columns" [rowHeight]="20" [gridRef]="gridRef">${PARTS}</div>
                }
            `,
        })
        class Toggle {
            readonly gridRef = inject(GRID_REF);
            readonly rows = people;
            readonly columns = columns;
            readonly shown = signal(false);
        }
        const { container } = await render(Toggle);
        expect(seen.at(-1)).toBeNull();
        const button = container.querySelector("button");
        if (!button) throw new Error("no button");
        click(button);
        await settled();
        expect(seen.at(-1)).toBe("rows 1000");
    });

    it("the window injection functions give the empty window until then", async () => {
        @Component({
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `<output data-testid="lonely">{{ rows().visible.start }}–{{ rows().visible.end }}</output>`,
        })
        class Lonely {
            readonly rows = injectRowWindow(createDataGridRef<Person>());
        }
        const { container } = await render(Lonely);
        expect(
            container.querySelector('[data-testid="lonely"]'),
        ).toHaveTextContent("0–0");
    });

    it("without a gridRef, they still need a root", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        @Component({ template: "" })
        class Outside {
            readonly rows = injectRowWindow();
        }
        @Component({ template: "" })
        class OutsideGrid {
            readonly grid = injectDataGrid();
        }
        expect(() => TestBed.createComponent(Outside)).toThrow(
            /\[dataGridRoot\]/,
        );
        expect(() => TestBed.createComponent(OutsideGrid)).toThrow(
            /\[dataGridRoot\]/,
        );
        error.mockRestore();
        warn.mockRestore();
    });
});
