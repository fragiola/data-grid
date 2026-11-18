import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    type CellInfo,
    type Column,
    DataGrid,
    type DataGridFeatures,
    type RowMeta,
} from "../src";
import { navigation } from "../src/navigation";
import { RowDetail, rowExpansion } from "../src/row-expansion";
import { rowGrouping, useGroupToggle } from "../src/row-grouping";
import { cellSpans } from "../src/spans";
import { Summary, summaryRows } from "../src/summary-rows";
import { settled, stubViewportSize } from "./helpers";

// The row features (Epic #151): without them a grid renders no detail, no summary layer and no
// span, and its group toggles expand nothing; installed, each does as before.

interface Item {
    id: number;
}

const items: Item[] = Array.from({ length: 10 }, (_, id) => ({ id }));

/** Row 0 a group row (its toggle in the first column), the rest its data rows. */
const getRowMeta = (index: number): RowMeta | undefined =>
    index === 0
        ? {
              group: {
                  key: "g",
                  columnKey: "a",
                  value: 1,
                  depth: 0,
                  childCount: 9,
                  aggregates: {},
              },
          }
        : { depth: 1, parentIndex: 0 };

function Toggle({ cell }: { cell: CellInfo<Item> }) {
    const { state, props } = useGroupToggle(cell);
    return state.expandable ? (
        <button type="button" data-testid="toggle" {...props} />
    ) : null;
}

const columns: Column<Item>[] = [
    {
        key: "a",
        width: 100,
        colSpan: (args) => (args.type === "row" ? 2 : 1),
        renderCell: () => "a",
        renderGroupCell: (cell) => <Toggle cell={cell as CellInfo<Item>} />,
    },
    { key: "b", width: 100 },
    { key: "c", width: 100 },
];

stubViewportSize(400, 300);

function Grid({ features }: { features: DataGridFeatures }) {
    return (
        <DataGrid.Root
            features={features}
            columns={columns}
            rowCount={items.length}
            getRow={(index) => items[index]}
            getRowMeta={getRowMeta}
            rowHeight={24}
            {...({
                defaultExpandedRowKeys: [1],
                summaryRows: { top: 1 },
            } as object)}
        >
            <DataGrid.Grid aria-label="Items">
                <DataGrid.Header />
                <Summary position="top" />
                <DataGrid.Body>
                    <DataGrid.Rows<Item>>
                        {(row) => (
                            <DataGrid.Row row={row}>
                                <DataGrid.Cells />
                                <RowDetail>detail {row.rowIndex}</RowDetail>
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

const part = (container: ParentNode, name: string) =>
    container.querySelectorAll(`[data-grid-part="${name}"]`);

describe("a grid without the row features", () => {
    it("renders no detail, no summary layer and no span, and its toggles expand nothing", async () => {
        const { container, getByTestId } = render(
            <Grid features={[navigation()]} />,
        );
        await settled();
        expect(part(container, "row-detail")).toHaveLength(0);
        expect(part(container, "summary")).toHaveLength(0);
        expect(container.querySelector("[aria-colspan]")).toBeNull();
        expect(part(container, "grid")[0]).toHaveAttribute("role", "grid");
        const row = container.querySelector('[data-row-index="0"]');
        expect(row).not.toHaveAttribute("aria-expanded");
        act(() => {
            fireEvent.click(getByTestId("toggle"));
        });
        expect(
            container.querySelector(
                '[data-grid-part="row"][data-group-expanded]',
            ),
        ).toBeNull();
    });
});

describe("a grid with them", () => {
    it("renders the detail, the summary layer and the span, and its toggles expand", async () => {
        const { container, getByTestId } = render(
            <Grid
                features={[
                    navigation(),
                    cellSpans(),
                    rowGrouping(),
                    rowExpansion(),
                    summaryRows(),
                ]}
            />,
        );
        await settled();
        expect(part(container, "row-detail")).toHaveLength(1);
        expect(part(container, "summary")).toHaveLength(1);
        expect(container.querySelector('[aria-colspan="2"]')).not.toBeNull();
        expect(part(container, "grid")[0]).toHaveAttribute("role", "treegrid");
        act(() => {
            fireEvent.click(getByTestId("toggle"));
        });
        expect(
            container.querySelector(
                '[data-grid-part="row"][data-group-expanded]',
            ),
        ).not.toBeNull();
    });
});
