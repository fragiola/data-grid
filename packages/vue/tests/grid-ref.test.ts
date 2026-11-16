import { describe, expect, it, vi } from "vitest";
import { defineComponent, type PropType, ref, type VNodeChild } from "vue";
import {
    type Column,
    createDataGridRef,
    type DataGridRef,
    typedDataGrid,
    useColumnWindow,
    useDataGrid,
    useDataGridRef,
    useRowWindow,
} from "../src";
import {
    click,
    h,
    renderGrid,
    root,
    scrollRoot,
    settled,
    stubViewportSize,
} from "./helpers";

// A grid reached from outside its root (Epic #23, R2): `gridRef` holds the root's model and
// engine, and the composables that take it follow the grid from anywhere. jsdom lays nothing
// out: the viewport's size is faked on the root element (400 × 235: a 35px header, then 10 rows
// of 20).

interface Person {
    id: number;
    name: string;
}

const people: Person[] = Array.from({ length: 1_000 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
}));

const columns: Column<Person, VNodeChild>[] = [
    { key: "name", name: "Name", width: 200 },
    { key: "id", name: "Id", width: 100 },
];

const G = typedDataGrid<Person>();

stubViewportSize(400, 235);

function grid({
    gridRef,
    getRow,
    key,
}: {
    gridRef: DataGridRef<Person>;
    getRow?: (index: number) => Person | undefined;
    key?: number;
}) {
    const data = getRow
        ? { rowCount: people.length, getRow }
        : { rows: people };
    return h(
        G.Root,
        { key, columns, ...data, rowHeight: 20, gridRef },
        {
            default: () => [
                h(G.Grid, null, {
                    default: () => [h(G.Header), h(G.Body)],
                }),
            ],
        },
    );
}

/** Shows the rows in view, from outside the grid; counts its own renders. */
const StatusBar = defineComponent({
    props: {
        gridRef: {
            type: Object as PropType<DataGridRef<Person>>,
            required: true,
        },
        renders: { type: Function as PropType<() => void>, default: undefined },
    },
    setup(props) {
        const rows = useRowWindow(props.gridRef);
        const columnWindow = useColumnWindow(props.gridRef);
        return () => {
            props.renders?.();
            return h(
                "output",
                { "data-testid": "status" },
                `${rows.value.visible.start}–${rows.value.visible.end} × ${columnWindow.value.visible.end}`,
            );
        };
    },
});

const status = (container: ParentNode) =>
    container.querySelector('[data-testid="status"]');

async function scroll(element: HTMLElement, top: number) {
    scrollRoot(element, { top });
    await settled();
}

/** A component that owns the ref and renders the grid; hands the ref out for the test. */
function app({
    onRef,
    renders,
    before,
    children,
}: {
    onRef: (gridRef: DataGridRef<Person>) => void;
    renders?: () => void;
    before?: (gridRef: DataGridRef<Person>) => VNodeChild;
    children?: (gridRef: DataGridRef<Person>) => VNodeChild;
}) {
    return defineComponent({
        setup() {
            const gridRef = useDataGridRef<Person>();
            return () => {
                renders?.();
                onRef(gridRef);
                return [
                    before?.(gridRef),
                    children ? children(gridRef) : grid({ gridRef }),
                ];
            };
        },
    });
}

describe("gridRef", () => {
    it("holds the root's model and engine while it is mounted, and null after", async () => {
        let gridRef: DataGridRef<Person> | undefined;
        const { unmount } = renderGrid(
            app({
                onRef: (held) => {
                    gridRef = held;
                },
            }),
        );
        await settled();
        const current = gridRef?.current;
        expect(current?.model.get("row-count")).toBe(1_000);
        expect(current?.engine.get("row-window").visible).toEqual({
            start: 0,
            end: 10,
        });
        unmount();
        expect(gridRef?.current).toBeNull();
    });

    it("is the same object across renders", async () => {
        const refs = new Set<DataGridRef<Person>>();
        const tick = ref(0);
        renderGrid(
            app({
                onRef: (held) => refs.add(held),
                // the render reads `tick`: a new one renders the app again
                renders: () => tick.value,
            }),
        );
        await settled();
        tick.value += 1;
        await settled();
        expect(refs.size).toBe(1);
    });

    it("updates a component rendered before the root once the root takes it", async () => {
        const { container } = renderGrid(
            app({
                onRef: () => {},
                before: (gridRef) => h(StatusBar, { gridRef }),
            }),
        );
        await settled();
        expect(status(container)).toHaveTextContent("0–10 × 2");
        await scroll(root(container), 100);
        expect(status(container)).toHaveTextContent("5–15 × 2");
    });

    it("re-renders the component reading a window, never the one rendering the root", async () => {
        const appRendered = vi.fn();
        const statusRendered = vi.fn();
        const { container } = renderGrid(
            app({
                onRef: () => {},
                renders: appRendered,
                before: (gridRef) =>
                    h(StatusBar, { gridRef, renders: statusRendered }),
            }),
        );
        await settled();
        const appRenders = appRendered.mock.calls.length;
        const statusRenders = statusRendered.mock.calls.length;
        await scroll(root(container), 20); // one row down: inside the overscan
        expect(statusRendered.mock.calls.length).toBe(statusRenders + 1);
        await scroll(root(container), 400); // twenty rows down: a new rendered window
        expect(statusRendered.mock.calls.length).toBe(statusRenders + 2);
        expect(appRendered.mock.calls.length).toBe(appRenders);
        await scroll(root(container), 400); // where it is: nothing
        expect(statusRendered.mock.calls.length).toBe(statusRenders + 2);
    });

    // React's StrictMode (double effects) has no Vue counterpart: the live grid, driven
    it("drives the live grid under StrictMode", async () => {
        let gridRef: DataGridRef<Person> | undefined;
        const { container } = renderGrid(
            app({
                onRef: (held) => {
                    gridRef = held;
                },
                before: (held) => h(StatusBar, { gridRef: held }),
            }),
        );
        await settled();
        gridRef?.current?.model.run("active-position.set", {
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
        let gridRef: DataGridRef<Person> | undefined;
        const key = ref(0);
        const { container } = renderGrid(
            app({
                onRef: (held) => {
                    gridRef = held;
                },
                before: (held) => [
                    h(StatusBar, { gridRef: held }),
                    h(
                        "button",
                        {
                            type: "button",
                            onClick: () => {
                                key.value += 1;
                            },
                        },
                        "remount",
                    ),
                ],
                children: (held) => grid({ key: key.value, gridRef: held }),
            }),
        );
        await settled();
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
        let gridRef: DataGridRef<Person> | undefined;
        const { container } = renderGrid(
            app({
                onRef: (held) => {
                    gridRef = held;
                },
                children: (held) => [
                    grid({ gridRef: held }),
                    grid({ gridRef: held }),
                ],
            }),
        );
        await settled();
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining("already held"),
        );
        // the first root keeps it, and both grids still work
        const [first] = container.querySelectorAll('[data-grid-part="root"]');
        expect(gridRef?.current?.engine.adapter.getView().rowCount).toBe(1_000);
        gridRef?.current?.model.run("active-position.set", {
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
        const { unmount } = renderGrid(() => grid({ gridRef: made }));
        await settled();
        expect(made.current?.model.get("row-count")).toBe(1_000);
        unmount();
        expect(made.current).toBeNull();
        const fake: DataGridRef<Person> = {
            current: null,
            subscribe: () => () => {},
        };
        renderGrid(() => grid({ gridRef: fake }));
        await settled();
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining("useDataGridRef()"),
        );
        error.mockRestore();
    });

    it("renders rows that arrive through rows.changed, with the same getRow", async () => {
        const loaded = new Map<number, Person>();
        const getRow = (index: number) => loaded.get(index);
        const arrive = (start: number, end: number) => {
            for (const person of people.slice(start, end)) {
                loaded.set(person.id, person);
            }
        };
        let gridRef: DataGridRef<Person> | undefined;
        const { container } = renderGrid(
            app({
                onRef: (held) => {
                    gridRef = held;
                },
                children: (held) => grid({ gridRef: held, getRow }),
            }),
        );
        await settled();
        const loading = () =>
            container.querySelectorAll('[data-grid-part="row"][data-loading]')
                .length;
        expect(loading()).toBe(14);
        // rows far out of view arrive: nothing on screen changes
        arrive(500, 520);
        gridRef?.current?.model.run("rows.changed", { start: 500, end: 520 });
        await settled();
        expect(loading()).toBe(14);
        // the first rows arrive
        arrive(0, 14);
        gridRef?.current?.model.run("rows.changed", { start: 0, end: 14 });
        await settled();
        expect(loading()).toBe(0);
        expect(container).toHaveTextContent("Person 3");
    });
});

describe("hooks outside the root", () => {
    it("useDataGrid(gridRef) is null until a root takes the ref, then its grid", async () => {
        const seen: (string | null)[] = [];
        const Reader = defineComponent({
            props: {
                gridRef: {
                    type: Object as PropType<DataGridRef<Person>>,
                    required: true,
                },
            },
            setup(props) {
                const held = useDataGrid(props.gridRef);
                return () => {
                    const current = held.value;
                    seen.push(
                        current
                            ? `rows ${current.model.get("row-count")}`
                            : null,
                    );
                    return null;
                };
            },
        });
        const Toggle = defineComponent({
            setup() {
                const gridRef = useDataGridRef<Person>();
                const shown = ref(false);
                return () => [
                    h(Reader, { gridRef }),
                    h(
                        "button",
                        {
                            type: "button",
                            onClick: () => {
                                shown.value = true;
                            },
                        },
                        "show",
                    ),
                    shown.value ? grid({ gridRef }) : null,
                ];
            },
        });
        const { container } = renderGrid(Toggle);
        await settled();
        expect(seen.at(-1)).toBeNull();
        const button = container.querySelector("button");
        if (!button) throw new Error("no button");
        click(button);
        await settled();
        expect(seen.at(-1)).toBe("rows 1000");
    });

    it("the window hooks give the empty window until then", async () => {
        const Lonely = defineComponent({
            setup() {
                const gridRef = useDataGridRef<Person>();
                const rows = useRowWindow(gridRef);
                return () =>
                    h(
                        "output",
                        { "data-testid": "lonely" },
                        `${rows.value.visible.start}–${rows.value.visible.end}`,
                    );
            },
        });
        const { container } = renderGrid(Lonely);
        await settled();
        expect(
            container.querySelector('[data-testid="lonely"]'),
        ).toHaveTextContent("0–0");
    });

    it("without a gridRef, they still need a root", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const Outside = defineComponent({
            setup() {
                useRowWindow();
                return () => null;
            },
        });
        const OutsideGrid = defineComponent({
            setup() {
                useDataGrid();
                return () => null;
            },
        });
        expect(() => renderGrid(Outside)).toThrow(/DataGrid.Root/);
        expect(() => renderGrid(OutsideGrid)).toThrow(/DataGrid.Root/);
        error.mockRestore();
        warn.mockRestore();
    });
});
