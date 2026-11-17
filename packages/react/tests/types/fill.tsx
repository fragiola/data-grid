// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type CellInfo,
    type Column,
    DataGrid,
    type RangeFill,
    useDataGrid,
} from "../../src";
import {
    type FilledCell,
    fillHandle,
    repeatedFill,
    useFillHandle,
} from "../../src/fill";
import { navigation } from "../../src/navigation";
import { cellRange } from "../../src/range";

// the fill handle is a feature (Epic #144), over ranges: installed, `onFill` compiles
const features = [navigation(), cellRange(), fillHandle()] as const;

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
            features={features}
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
            features={features}
            // @ts-expect-error: a fill's ranges are cell ranges
            onFill={(fill: { source: number }) => fill.source}
        />
    );
}
