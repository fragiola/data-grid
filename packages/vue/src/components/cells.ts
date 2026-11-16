import { Fragment, h } from "vue";
import { useCells } from "../composables/use-cells";
import { type CellInfo, useRowContext } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type SlotFunction,
} from "../utils/primitive";
import { Cell } from "./cell";

export type CellsProps = Record<never, never>;

export interface CellsSlots<TRow = unknown> {
    /** renders a cell; without it, `<DataGrid.Cell :cell="cell" />` */
    default?: SlotFunction<{ cell: CellInfo<TRow> }>;
}

/** The cells of the row it is in, for the rendered columns. */
export const Cells: DataGridComponent<CellsProps, CellsSlots> = definePrimitive<
    CellsProps,
    CellsSlots
>("Cells", [], (_props, { slots }) => {
    const row = useRowContext("Cells");
    const cells = useCells(row);
    return () =>
        cells.value.map((cell) =>
            h(
                Fragment,
                { key: cell.column.key },
                slots.default ? slots.default({ cell }) : [h(Cell, { cell })],
            ),
        );
});
