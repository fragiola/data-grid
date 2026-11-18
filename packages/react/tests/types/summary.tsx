// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type Column,
    type ColumnGroup,
    DataGrid,
    type SummaryPosition,
    type SummaryRowCounts,
    useDataGrid,
} from "../../src";
import {
    Summary,
    SummaryCell,
    SummaryCells,
    SummaryRow,
    SummaryRows,
    summaryRows,
} from "../../src/summary-rows";

// the summary rows' keys and props are the feature's (Epic #151)
const summarized = [summaryRows()] as const;

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
    const { model } = useDataGrid<Person, typeof summarized>();
    // @ts-expect-error: without the feature, none of its keys
    useDataGrid<Person>().model.run("summary-rows.set", { top: 1 });
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
        <DataGrid.Root
            columns={[age]}
            rows={people}
            features={summarized}
            summaryRows={{ bottom: 1 }}
            summaryRowHeight={30}
        >
            <DataGrid.Grid>
                <DataGrid.Header />
                <Summary position="top" />
                <DataGrid.Body />
                <Summary
                    position="bottom"
                    render={<tfoot />}
                    className={(state) => state.position}
                >
                    <SummaryRows>
                        {(row) => (
                            <SummaryRow
                                row={row}
                                render={<tr />}
                                className={(state) =>
                                    state.active ? "active" : ""
                                }
                            >
                                <SummaryCells<Person>>
                                    {(cell) => (
                                        <SummaryCell
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
                                </SummaryCells>
                            </SummaryRow>
                        )}
                    </SummaryRows>
                </Summary>
                {/* @ts-expect-error: a position is top or bottom */}
                <Summary position="middle" />
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

// without the feature, its props do not compile
export const bare = (
    // @ts-expect-error: summaryRows is the summary rows feature's
    <DataGrid.Root columns={[age]} rows={people} summaryRows={{ top: 1 }} />
);
