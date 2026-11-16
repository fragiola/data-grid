import { h, provide } from "vue";
import { useHeaderRows } from "../composables/use-header-rows";
import { type HeaderRowInfo, HeaderRowKey } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type SlotFunction,
} from "../utils/primitive";
import { HeaderRow } from "./header-row";

export type HeaderRowsProps = Record<never, never>;

export interface HeaderRowsSlots<TRow = unknown> {
    /** renders a header row; without it, `<DataGrid.HeaderRow :row="row" />` */
    default?: SlotFunction<{ row: HeaderRowInfo<TRow> }>;
}

/** A header row's own provider: the parts inside a slot's row know their row. */
const HeaderRowScope = definePrimitive<
    { row: HeaderRowInfo },
    { default?: SlotFunction<Record<never, never>> }
>("HeaderRowScope", ["row"], (props, { slots }) => {
    provide(HeaderRowKey, () => props.row);
    return () => slots.default?.({});
});

/**
 * The header rows, the top one first: one without column groups, one per level with them (the
 * columns' row last).
 */
export const HeaderRows: DataGridComponent<HeaderRowsProps, HeaderRowsSlots> =
    definePrimitive<HeaderRowsProps, HeaderRowsSlots>(
        "HeaderRows",
        [],
        (_props, { slots }) => {
            const rows = useHeaderRows();
            return () =>
                rows.value.map((row) =>
                    h(
                        HeaderRowScope,
                        { key: row.rowIndex, row },
                        {
                            default: () =>
                                slots.default
                                    ? slots.default({ row })
                                    : [h(HeaderRow, { row })],
                        },
                    ),
                );
        },
    );
