import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, StrictMode, useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
    type Column,
    createDataGridRef,
    DataGrid,
    type DataGridRef,
    useColumnWindow,
    useDataGrid,
    useDataGridRef,
    useRowWindow,
} from "../src";

// A grid reached from outside its root (Epic #23, R2): `gridRef` holds the root's model and
// engine, and the hooks that take it follow the grid from anywhere. jsdom lays nothing out: the
// viewport's size is faked on the root element (400 × 235: a 35px header, then 10 rows of 20).

interface Person {
    id: number;
    name: string;
}

const people: Person[] = Array.from({ length: 1_000 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
}));

const columns: Column<Person>[] = [
    { key: "name", name: "Name", width: 200 },
    { key: "id", name: "Id", width: 100 },
];

beforeAll(() => {
    for (const [property, size] of [
        ["clientWidth", 400],
        ["clientHeight", 235],
    ] as const) {
        Object.defineProperty(HTMLElement.prototype, property, {
            configurable: true,
            get(this: HTMLElement) {
                return this.dataset.gridPart === "root" ? size : 0;
            },
        });
    }
});

afterAll(() => {
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

function Grid({
    gridRef,
    getRow,
}: {
    gridRef: DataGridRef<Person>;
    getRow?: (index: number) => Person | undefined;
}) {
    return getRow ? (
        <DataGrid.Root
            columns={columns}
            rowCount={people.length}
            getRow={getRow}
            rowHeight={20}
            gridRef={gridRef}
        >
            <DataGrid.Grid>
                <DataGrid.Header />
                <DataGrid.Body />
            </DataGrid.Grid>
        </DataGrid.Root>
    ) : (
        <DataGrid.Root
            columns={columns}
            rows={people}
            rowHeight={20}
            gridRef={gridRef}
        >
            <DataGrid.Grid>
                <DataGrid.Header />
                <DataGrid.Body />
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

/** Shows the rows in view, from outside the grid; counts its own renders. */
function StatusBar({
    gridRef,
    renders,
}: {
    gridRef: DataGridRef<Person>;
    renders?: () => void;
}) {
    renders?.();
    const rows = useRowWindow(gridRef);
    const columnWindow = useColumnWindow(gridRef);
    return (
        <output data-testid="status">
            {rows.visible.start}–{rows.visible.end} × {columnWindow.visible.end}
        </output>
    );
}

function root(container: HTMLElement): HTMLElement {
    const element = container.querySelector('[data-grid-part="root"]');
    if (!(element instanceof HTMLElement)) throw new Error("no root");
    return element;
}

function scroll(element: HTMLElement, top: number) {
    act(() => {
        element.scrollTop = top;
        fireEvent.scroll(element);
    });
}

/** A component that owns the ref and renders the grid; hands the ref out for the test. */
function App({
    onRef,
    renders,
    before,
    children,
}: {
    onRef: (gridRef: DataGridRef<Person>) => void;
    renders?: () => void;
    before?: (gridRef: DataGridRef<Person>) => ReactNode;
    children?: (gridRef: DataGridRef<Person>) => ReactNode;
}) {
    renders?.();
    const gridRef = useDataGridRef<Person>();
    onRef(gridRef);
    return (
        <>
            {before?.(gridRef)}
            {children ? children(gridRef) : <Grid gridRef={gridRef} />}
        </>
    );
}

describe("gridRef", () => {
    it("holds the root's model and engine while it is mounted, and null after", () => {
        let gridRef: DataGridRef<Person> | undefined;
        const { unmount } = render(<App onRef={(ref) => (gridRef = ref)} />);
        const grid = gridRef?.current;
        expect(grid?.model.get("row-count")).toBe(1_000);
        expect(grid?.engine.get("row-window").visible).toEqual({
            start: 0,
            end: 10,
        });
        unmount();
        expect(gridRef?.current).toBeNull();
    });

    it("is the same object across renders", () => {
        const refs = new Set<DataGridRef<Person>>();
        const { rerender } = render(<App onRef={(ref) => refs.add(ref)} />);
        rerender(<App onRef={(ref) => refs.add(ref)} />);
        expect(refs.size).toBe(1);
    });

    it("updates a component rendered before the root once the root takes it", () => {
        const { container } = render(
            <App
                onRef={() => {}}
                before={(gridRef) => <StatusBar gridRef={gridRef} />}
            />,
        );
        expect(screen.getByTestId("status")).toHaveTextContent("0–10 × 2");
        scroll(root(container), 100);
        expect(screen.getByTestId("status")).toHaveTextContent("5–15 × 2");
    });

    it("re-renders the component reading a window, never the one rendering the root", () => {
        const app = vi.fn();
        const status = vi.fn();
        const { container } = render(
            <App
                onRef={() => {}}
                renders={app}
                before={(gridRef) => (
                    <StatusBar gridRef={gridRef} renders={status} />
                )}
            />,
        );
        const appRenders = app.mock.calls.length;
        const statusRenders = status.mock.calls.length;
        scroll(root(container), 20); // one row down: inside the overscan
        expect(status.mock.calls.length).toBe(statusRenders + 1);
        scroll(root(container), 400); // twenty rows down: a new rendered window
        expect(status.mock.calls.length).toBe(statusRenders + 2);
        expect(app.mock.calls.length).toBe(appRenders);
        scroll(root(container), 400); // where it is: nothing
        expect(status.mock.calls.length).toBe(statusRenders + 2);
    });

    it("drives the live grid under StrictMode", () => {
        let gridRef: DataGridRef<Person> | undefined;
        const { container } = render(
            <StrictMode>
                <App
                    onRef={(ref) => (gridRef = ref)}
                    before={(ref) => <StatusBar gridRef={ref} />}
                />
            </StrictMode>,
        );
        act(() => {
            gridRef?.current?.model.run("active-position.set", {
                rowIndex: 2,
                columnIndex: 1,
            });
        });
        const active = container.querySelector(
            '[data-grid-part="cell"][data-active]',
        );
        expect(active).toHaveAttribute("data-row-index", "2");
        scroll(root(container), 100);
        expect(screen.getByTestId("status")).toHaveTextContent("5–15");
    });

    it("follows a remounted root", () => {
        let gridRef: DataGridRef<Person> | undefined;
        function Remounting() {
            const [key, setKey] = useState(0);
            return (
                <App
                    onRef={(ref) => (gridRef = ref)}
                    before={(ref) => (
                        <>
                            <StatusBar gridRef={ref} />
                            <button
                                type="button"
                                onClick={() => setKey((k) => k + 1)}
                            >
                                remount
                            </button>
                        </>
                    )}
                >
                    {(ref) => <Grid key={key} gridRef={ref} />}
                </App>
            );
        }
        const { container } = render(<Remounting />);
        const first = gridRef?.current;
        scroll(root(container), 100);
        expect(screen.getByTestId("status")).toHaveTextContent("5–15");
        fireEvent.click(screen.getByText("remount"));
        expect(gridRef?.current).not.toBeNull();
        expect(gridRef?.current).not.toBe(first);
        // the new root starts at the top, and the status bar follows it
        expect(screen.getByTestId("status")).toHaveTextContent("0–10");
        scroll(root(container), 200);
        expect(screen.getByTestId("status")).toHaveTextContent("10–20");
    });

    it("belongs to one mounted root: a second one is told in the console and does not take it", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        let gridRef: DataGridRef<Person> | undefined;
        const { container } = render(
            <App onRef={(ref) => (gridRef = ref)}>
                {(ref) => (
                    <>
                        <Grid gridRef={ref} />
                        <Grid gridRef={ref} />
                    </>
                )}
            </App>,
        );
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining("already held"),
        );
        // the first root keeps it, and both grids still work
        const [first] = container.querySelectorAll('[data-grid-part="root"]');
        expect(gridRef?.current?.engine.adapter.getView().rowCount).toBe(1_000);
        act(() => {
            gridRef?.current?.model.run("active-position.set", {
                rowIndex: 1,
                columnIndex: 0,
            });
        });
        expect(first?.querySelector("[data-active]")).not.toBeNull();
        expect(
            container.querySelectorAll('[data-grid-part="cell"][data-active]'),
        ).toHaveLength(1);
        error.mockRestore();
    });

    it("can be made outside a component, and refuses one it did not make", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const made = createDataGridRef<Person>();
        const { unmount } = render(<Grid gridRef={made} />);
        expect(made.current?.model.get("row-count")).toBe(1_000);
        unmount();
        expect(made.current).toBeNull();
        const fake: DataGridRef<Person> = {
            current: null,
            subscribe: () => () => {},
        };
        render(<Grid gridRef={fake} />);
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining("useDataGridRef()"),
        );
        error.mockRestore();
    });

    it("renders rows that arrive through rows.changed, with the same getRow", () => {
        const loaded = new Map<number, Person>();
        const getRow = (index: number) => loaded.get(index);
        const arrive = (start: number, end: number) => {
            for (const person of people.slice(start, end)) {
                loaded.set(person.id, person);
            }
        };
        let gridRef: DataGridRef<Person> | undefined;
        const { container } = render(
            <App onRef={(ref) => (gridRef = ref)}>
                {(ref) => <Grid gridRef={ref} getRow={getRow} />}
            </App>,
        );
        const loading = () =>
            container.querySelectorAll('[data-grid-part="row"][data-loading]')
                .length;
        expect(loading()).toBe(14);
        // rows far out of view arrive: nothing on screen changes
        arrive(500, 520);
        act(() => {
            gridRef?.current?.model.run("rows.changed", {
                start: 500,
                end: 520,
            });
        });
        expect(loading()).toBe(14);
        // the first rows arrive
        arrive(0, 14);
        act(() => {
            gridRef?.current?.model.run("rows.changed", { start: 0, end: 14 });
        });
        expect(loading()).toBe(0);
        expect(screen.getByText("Person 3")).toBeInTheDocument();
    });
});

describe("hooks outside the root", () => {
    it("useDataGrid(gridRef) is null until a root takes the ref, then its grid", () => {
        const seen: (string | null)[] = [];
        function Reader({ gridRef }: { gridRef: DataGridRef<Person> }) {
            const grid = useDataGrid(gridRef);
            seen.push(grid ? `rows ${grid.model.get("row-count")}` : null);
            return null;
        }
        function Toggle() {
            const gridRef = useDataGridRef<Person>();
            const [shown, setShown] = useState(false);
            return (
                <>
                    <Reader gridRef={gridRef} />
                    <button type="button" onClick={() => setShown(true)}>
                        show
                    </button>
                    {shown && <Grid gridRef={gridRef} />}
                </>
            );
        }
        render(<Toggle />);
        expect(seen.at(-1)).toBeNull();
        fireEvent.click(screen.getByText("show"));
        expect(seen.at(-1)).toBe("rows 1000");
    });

    it("the window hooks give the empty window until then", () => {
        function Lonely() {
            const gridRef = useDataGridRef<Person>();
            const rows = useRowWindow(gridRef);
            return (
                <output data-testid="lonely">
                    {rows.visible.start}–{rows.visible.end}
                </output>
            );
        }
        render(<Lonely />);
        expect(screen.getByTestId("lonely")).toHaveTextContent("0–0");
    });

    it("without a gridRef, they still need a root", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        function Outside() {
            useRowWindow();
            return null;
        }
        function OutsideGrid() {
            useDataGrid();
            return null;
        }
        expect(() => render(<Outside />)).toThrow(/DataGrid.Root/);
        expect(() => render(<OutsideGrid />)).toThrow(/DataGrid.Root/);
        error.mockRestore();
    });
});
