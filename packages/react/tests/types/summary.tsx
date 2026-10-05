// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type Column,
    type ColumnGroup,
    DataGrid,
    type SummaryPosition,
    type SummaryRowCounts,
    useDataGrid,
} from "../../src";

interface Person {
    id: string;
    age: number;
}

declare const people: Person[];

// one generic (D10): a summary cell's value is the app's, from its own closure
const total = people.reduce((sum, person) => sum + person.age, 0);

export const age: Column<Person> = {
    key: "age",
    width: 80,
    renderSummaryCell: ({ position, summaryIndex, column }) =>
        position === "bottom" && summaryIndex === 0
            ? `${column.name}: ${total}`
            : null,
    colSpan: (args) => (args.type === "summary" ? args.summaryIndex + 1 : 1),
};

export const group: ColumnGroup<Person> = {
    key: "g",
    children: [age],
    // @ts-expect-error: a group has no cells of its own
    renderSummaryCell: () => null,
};

// a summary cell's args carry no row
export const noRow: Column<Person> = {
    key: "id",
    width: 80,
    colSpan: (args) =>
        // @ts-expect-error: a summary row has no row of the app's
        args.type === "summary" ? args.row.age : undefined,
};

export function Totals() {
    const { model } = useDataGrid<Person>();
    const counts: SummaryRowCounts = model.get("summary-rows");
    const position: SummaryPosition | undefined = model.get("summary-row-by", {
        rowIndex: -2,
    })?.position;
    model.run("summary-rows.set", { top: 1, bottom: 1 });
    // @ts-expect-error: the counts are numbers
    model.run("summary-rows.set", { top: "1" });
    void counts;
    void position;
    return (
        <DataGrid.Root<Person>
            columns={[age]}
            rows={people}
            summaryRows={{ bottom: 1 }}
            summaryRowHeight={30}
        >
            <DataGrid.Grid>
                <DataGrid.Header />
                <DataGrid.Summary position="top" />
                <DataGrid.Body />
                <DataGrid.Summary
                    position="bottom"
                    render={<tfoot />}
                    className={(state) => state.position}
                >
                    <DataGrid.SummaryRows>
                        {(row) => (
                            <DataGrid.SummaryRow
                                row={row}
                                render={<tr />}
                                className={(state) =>
                                    state.active ? "active" : ""
                                }
                            >
                                <DataGrid.SummaryCells<Person>>
                                    {(cell) => (
                                        <DataGrid.SummaryCell
                                            cell={cell}
                                            render={<td />}
                                            style={(state) => ({
                                                fontWeight:
                                                    state.position === "top"
                                                        ? 600
                                                        : 400,
                                            })}
                                        />
                                    )}
                                </DataGrid.SummaryCells>
                            </DataGrid.SummaryRow>
                        )}
                    </DataGrid.SummaryRows>
                </DataGrid.Summary>
                {/* @ts-expect-error: a position is top or bottom */}
                <DataGrid.Summary position="middle" />
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}
