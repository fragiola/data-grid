import { Fragment, h } from "vue";
import { useHeaderCells } from "../composables/use-header-cells";
import type { HeaderCellInfo } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type SlotFunction,
} from "../utils/primitive";
import { HeaderCell } from "./header-cell";

export type HeaderCellsProps = Record<never, never>;

export interface HeaderCellsSlots<TRow = unknown> {
    /** renders a header cell; without it, `<DataGrid.HeaderCell :cell="cell" />` */
    default?: SlotFunction<{ cell: HeaderCellInfo<TRow> }>;
}

/**
 * A header row's cells: groups and columns intersecting the column window (a group cut by it
 * included), plus the one holding the active column.
 */
export const HeaderCells: DataGridComponent<
    HeaderCellsProps,
    HeaderCellsSlots
> = definePrimitive<HeaderCellsProps, HeaderCellsSlots>(
    "HeaderCells",
    [],
    (_props, { slots }) => {
        const cells = useHeaderCells();
        return () =>
            cells.value.map((cell) =>
                h(
                    Fragment,
                    { key: cell.key },
                    slots.default
                        ? slots.default({ cell })
                        : [h(HeaderCell, { cell })],
                ),
            );
    },
);
