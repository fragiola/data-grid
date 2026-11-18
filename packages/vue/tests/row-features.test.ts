import { describe, expect, it } from "vitest";
import type { VNodeChild } from "vue";
import {
    type CellInfo,
    type Column,
    type RowInfo,
    type RowMeta,
    typedDataGrid,
} from "../src";
import { navigation } from "../src/navigation";
import { RowDetail, rowExpansion } from "../src/row-expansion";
import { rowGrouping, useGroupToggle } from "../src/row-grouping";
import { cellSpans } from "../src/spans";
import { Summary, summaryRows } from "../src/summary-rows";
import {
    cellAt,
    click,
    h,
    renderGrid,
    settled,
    stubViewportSize,
} from "./helpers";

// The row features (Epic #151): row expansion, row grouping, column spans and summary rows are
// opt-in. A grid without them renders no detail and no summary row, ignores a column's colSpan
// and toggles no group; with them, as before.

interface Person {
    name: string;
}

const people: Person[] = Array.from({ length: 10 }, (_, i) => ({
    name: `Person ${i}`,
}));

const columns: Column<Person, VNodeChild>[] = [
    {
        key: "name",
        width: 150,
        colSpan: (args) => (args.type === "row" ? 2 : 1),
    },
    { key: "age", width: 80 },
];

/** Row 0 a group row, the others its rows. */
const getRowMeta = (index: number): RowMeta =>
    index === 0
        ? {
              group: {
                  key: "g",
                  columnKey: "name",
                  value: "g",
                  depth: 0,
                  childCount: 9,
                  aggregates: {},
              },
          }
        : { depth: 1, parentIndex: 0 };

const ROWS = [
    navigation(),
    rowExpansion(),
    rowGrouping(),
    cellSpans(),
    summaryRows(),
] as const;
const NAVIGATION = [navigation()] as const;
const Bare = typedDataGrid<Person, typeof NAVIGATION>();

stubViewportSize(400, 235);

/** A toggle in a row's first cell, from `useGroupToggle`. */
const Toggle = {
    props: ["cell"],
    setup(props: { cell: CellInfo<Person> }) {
        const toggle = useGroupToggle(() => props.cell);
        return () =>
            toggle.state.value.expandable
                ? h("button", { ...toggle.props.value, "data-toggle": "" })
                : null;
    },
};

/** A grid with every row expanded and a summary row at the top, with the row features or not. */
function grid(installed: boolean) {
    const features = installed ? ROWS : NAVIGATION;
    return h(
        Bare.Root,
        {
            features,
            columns,
            rows: people,
            rowHeight: 20,
            getRowMeta,
            ...(installed
                ? {
                      defaultExpandedRowKeys: [1],
                      summaryRows: { top: 1 },
                  }
                : {}),
        } as never,
        () => [
            h(Bare.Grid, null, () => [
                h(Summary, { position: "top" }),
                h(Bare.Body, null, () => [
                    h(Bare.Rows, null, {
                        default: ({ row }: { row: RowInfo<Person> }) =>
                            h(Bare.Row, { row }, () => [
                                h(Bare.Cells, null, {
                                    default: ({
                                        cell,
                                    }: {
                                        cell: CellInfo<Person>;
                                    }) =>
                                        h(Bare.Cell, { cell }, () =>
                                            cell.columnIndex === 0
                                                ? [h(Toggle, { cell })]
                                                : [],
                                        ),
                                }),
                                h(RowDetail, null, () => "detail"),
                            ]),
                    }),
                ]),
            ]),
        ],
    );
}

const rowOf = (container: HTMLElement, rowIndex: number) =>
    container.querySelector(
        `[data-grid-part="row"][data-row-index="${rowIndex}"]`,
    );

const part = (container: HTMLElement, name: string) =>
    container.querySelectorAll(`[data-grid-part="${name}"]`);

describe("a grid without the row features", () => {
    it("renders no detail, no summary, no span, and toggles no group", async () => {
        const { container, unmount } = renderGrid(() => grid(false));
        await settled();
        // a toggle's click expands nothing
        const toggle = container.querySelector<HTMLElement>("[data-toggle]");
        click(toggle as HTMLElement);
        await settled();
        expect(part(container, "row-detail")).toHaveLength(0);
        expect(part(container, "summary")).toHaveLength(0);
        expect(cellAt(container, 1, 0)).not.toHaveAttribute("aria-colspan");
        expect(container.querySelector("[data-toggle]")).toHaveAttribute(
            "aria-expanded",
            "false",
        );
        expect(rowOf(container, 0)).not.toHaveAttribute("aria-level");
        expect(part(container, "grid")[0]).toHaveAttribute("role", "grid");
        unmount();
    });
});

describe("a grid with them", () => {
    it("renders its detail and summary, spans and toggles its groups", async () => {
        const { container, unmount } = renderGrid(() => grid(true));
        await settled();
        expect(part(container, "row-detail")).toHaveLength(1);
        expect(part(container, "summary-row")).toHaveLength(1);
        expect(cellAt(container, 1, 0)).toHaveAttribute("aria-colspan", "2");
        expect(part(container, "grid")[0]).toHaveAttribute("role", "treegrid");
        const toggle = container.querySelector<HTMLElement>("[data-toggle]");
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        click(toggle as HTMLElement);
        await settled();
        expect(container.querySelector("[data-toggle]")).toHaveAttribute(
            "aria-expanded",
            "true",
        );
        unmount();
    });
});
