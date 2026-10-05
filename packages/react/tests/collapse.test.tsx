import { act, fireEvent, render } from "@testing-library/react";
import { Profiler, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
    type Column,
    type ColumnOrGroup,
    DataGrid,
    type HeaderCellInfo,
    type RootProps,
    useDataGrid,
    useGroupLabel,
    useHeaderCell,
} from "../src";
import { cellAt, root, stubViewportSize, tags } from "./helpers";

// Collapsible groups and sticky labels (Epic #85, E1.3): the collapsed groups controlled or not
// on `Root`, toggled by the app's own control in the group's header cell; `data-collapsible`,
// `data-collapsed`; a group's label (`useGroupLabel`) whose inset the engine writes while the
// group scrolls, React rendering nothing for it (D9). Both structures.

interface Row {
    id: number;
}

const rows: Row[] = Array.from({ length: 30 }, (_, id) => ({ id }));

const column = (
    key: string,
    extra: Partial<Column<Row>> = {},
): Column<Row> => ({
    key,
    name: key.toUpperCase(),
    width: 100,
    getValue: (row) => `${row.id}${key}`,
    ...extra,
});

/** "id"; "g" collapsible ("g0" both, "g1"–"g5" expanded, "sum" collapsed); "h" (h0, h1); 20 more */
const COLUMNS: ColumnOrGroup<Row>[] = [
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

/** A group's label and its toggle, as an app writes them. */
function GroupContent({ cell }: { cell: HeaderCellInfo<Row> }) {
    const { model } = useDataGrid<Row>();
    const { state } = useHeaderCell(cell);
    const label = useGroupLabel(cell);
    return (
        <span {...label.props}>
            {cell.group?.name}
            {state.collapsed !== undefined ? (
                <button
                    type="button"
                    data-testid={`toggle-${cell.key}`}
                    aria-expanded={!state.collapsed}
                    onClick={() =>
                        model.run("column-groups.toggle", {
                            groupKey: cell.key,
                        })
                    }
                >
                    ±
                </button>
            ) : null}
        </span>
    );
}

type GridProps = Pick<
    RootProps<Row>,
    | "collapsedGroupKeys"
    | "defaultCollapsedGroupKeys"
    | "onCollapsedGroupKeysChange"
    | "maxScrollSize"
> & { table?: boolean };

function Grid({ table = false, ...props }: GridProps) {
    const tag = tags(table);
    return (
        <DataGrid.Root
            columns={COLUMNS}
            rows={rows}
            rowHeight={20}
            overscan={{ columns: 1 }}
            {...props}
        >
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header}>
                    <DataGrid.HeaderRows<Row>>
                        {(row) => (
                            <DataGrid.HeaderRow
                                row={row}
                                render={tag.headerRow}
                            >
                                <DataGrid.HeaderCells<Row>>
                                    {(cell) => (
                                        <DataGrid.HeaderCell
                                            cell={cell}
                                            render={tag.headerCell}
                                        >
                                            {cell.group ? (
                                                <GroupContent cell={cell} />
                                            ) : undefined}
                                        </DataGrid.HeaderCell>
                                    )}
                                </DataGrid.HeaderCells>
                            </DataGrid.HeaderRow>
                        )}
                    </DataGrid.HeaderRows>
                </DataGrid.Header>
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Row>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Row>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={tag.cell}
                                        />
                                    )}
                                </DataGrid.Cells>
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    );
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

function toggle(container: HTMLElement, key: string) {
    const button = container.querySelector(`[data-testid="toggle-${key}"]`);
    if (!button) throw new Error(`no toggle ${key}`);
    fireEvent.click(button);
}

for (const table of [false, true]) {
    describe(table ? "as a table" : "as divs", () => {
        it("toggles a group from the app's control, its header cell telling it", () => {
            const onCollapsedGroupKeysChange = vi.fn();
            const { container } = render(
                <Grid
                    table={table}
                    onCollapsedGroupKeysChange={onCollapsedGroupKeysChange}
                />,
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
            toggle(container, "g");
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
    it("starts collapsed, uncontrolled", () => {
        const { container } = render(
            <Grid defaultCollapsedGroupKeys={["g"]} />,
        );
        expect(groupCell(container, "g")).toHaveAttribute("data-collapsed");
        toggle(container, "g");
        expect(groupCell(container, "g")).not.toHaveAttribute("data-collapsed");
    });

    it("asks a controlled parent, and follows its prop", () => {
        const asked = vi.fn();
        function Parent({ follow }: { follow: boolean }) {
            const [keys, setKeys] = useState<readonly string[]>([]);
            return (
                <Grid
                    collapsedGroupKeys={keys}
                    onCollapsedGroupKeysChange={(next) => {
                        asked(next);
                        if (follow) setKeys(next);
                    }}
                />
            );
        }
        const declined = render(<Parent follow={false} />);
        toggle(declined.container, "g");
        expect(asked).toHaveBeenLastCalledWith(["g"]);
        expect(groupCell(declined.container, "g")).not.toHaveAttribute(
            "data-collapsed",
        );
        declined.unmount();
        const followed = render(<Parent follow />);
        toggle(followed.container, "g");
        expect(groupCell(followed.container, "g")).toHaveAttribute(
            "data-collapsed",
        );
    });

    it("takes the same keys in another order as no change", () => {
        const onCollapsedGroupKeysChange = vi.fn();
        const { container, rerender } = render(
            <Grid
                collapsedGroupKeys={["g", "gone"]}
                onCollapsedGroupKeysChange={onCollapsedGroupKeysChange}
            />,
        );
        rerender(
            <Grid
                collapsedGroupKeys={["gone", "g"]}
                onCollapsedGroupKeysChange={onCollapsedGroupKeysChange}
            />,
        );
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

    it("is sticky, marked with its group's key, its inset the engine's", () => {
        const { container } = render(<Grid />);
        const element = label(container);
        expect(element.style.position).toBe("sticky");
        expect(element.style.left).toBe("0px");
    });

    it("stays at the view's start through a scroll, React rendering nothing", () => {
        let commits = 0;
        const { container } = render(
            <Profiler id="grid" onRender={() => commits++}>
                <Grid />
            </Profiler>,
        );
        const viewport = root(container);
        act(() => {
            viewport.scrollLeft = 300;
            fireEvent.scroll(viewport);
        });
        const at = label(container).style.left;
        commits = 0;
        // inside the overscan: no render, and the label's inset holds (sticky keeps it in place)
        for (const left of [310, 330, 350]) {
            viewport.scrollLeft = left;
            fireEvent.scroll(viewport);
        }
        expect(commits).toBe(0);
        expect(label(container).style.left).toBe(at);
    });

    it("follows every frame under scaled column scroll, React rendering nothing", () => {
        let commits = 0;
        const { container } = render(
            <Profiler id="grid" onRender={() => commits++}>
                <Grid maxScrollSize={1_200} />
            </Profiler>,
        );
        const viewport = root(container);
        // 2,800px in 1,200: "g" (100–700) scrolled partly out
        act(() => {
            viewport.scrollLeft = 100;
            fireEvent.scroll(viewport);
        });
        commits = 0;
        const insets = new Set<string>();
        for (const left of [101, 102, 103]) {
            viewport.scrollLeft = left;
            fireEvent.scroll(viewport);
            insets.add(label(container).style.left);
        }
        expect(commits).toBe(0);
        expect(insets.size).toBe(3);
    });
});
