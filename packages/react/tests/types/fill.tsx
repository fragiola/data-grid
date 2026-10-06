// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import { type FilledCell, repeatedFill } from "@fragiola/data-grid/fill";
import {
    type CellInfo,
    type Column,
    DataGrid,
    type RangeFill,
    useDataGrid,
    useFillHandle,
} from "../../src";

interface Sale {
    id: string;
    amount: number;
}

const columns: Column<Sale>[] = [{ key: "amount", width: 100 }];
declare const sales: Sale[];
declare function write(cells: readonly FilledCell[]): void;

export function Sales() {
    const { model } = useDataGrid<Sale>();
    return (
        <DataGrid.Root
            columns={columns}
            rows={sales}
            onFill={(fill: RangeFill) => {
                const first: number = fill.target.anchor.rowIndex;
                void first;
                write(
                    repeatedFill(fill, (cell) =>
                        model.get("cell-value-by", cell),
                    ),
                );
            }}
        />
    );
}

export function Handle({ cell }: { cell: CellInfo<Sale> }) {
    const { state, props } = useFillHandle(cell);
    const filling: boolean = state.filling;
    return state.visible ? (
        <span {...props} data-filling-now={filling} />
    ) : null;
}

export function Wrong() {
    return (
        <DataGrid.Root
            columns={columns}
            rows={sales}
            // @ts-expect-error: a fill's ranges are cell ranges
            onFill={(fill: { source: number }) => fill.source}
        />
    );
}
