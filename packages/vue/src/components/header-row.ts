import {
    type HeaderRowState,
    headerRowPartOf,
    LAYER_KEYS,
} from "@fragiola/data-grid";
import { h, provide } from "vue";
import { layerRef } from "../composables/internal";
import { useHeaderRowOf } from "../composables/use-header-cells";
import {
    type HeaderRowInfo,
    HeaderRowKey,
    useGridView,
    useRootGrid,
} from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";
import { HeaderCells } from "./header-cells";

export type { HeaderRowState } from "@fragiola/data-grid";

export interface HeaderRowProps<TRow = unknown> extends PrimitiveProps {
    /**
     * its header row; without it, the one `HeaderRows` renders, else the columns' row (with
     * column groups, render the rows through `HeaderRows`: a column spanning header rows is in
     * the top one)
     */
    row?: HeaderRowInfo<TRow> | undefined;
}

export interface HeaderRowSlots extends RenderSlot<HeaderRowState> {
    /** without it, its header cells (`DataGrid.HeaderCells`) */
    default?: SlotFunction<Record<never, never>>;
}

/**
 * A header row (`role="row"`), one of the layers the engine moves with the columns. A `<tr>`
 * with `as="tr"`. Without a slot, its header cells.
 */
export const HeaderRow: DataGridComponent<HeaderRowProps, HeaderRowSlots> =
    definePrimitive<HeaderRowProps, HeaderRowSlots>(
        "HeaderRow",
        ["row", "as"],
        (props, { attrs, slots }) => {
            const { engine } = useRootGrid();
            const view = useGridView();
            const row = useHeaderRowOf(() => props.row);
            provide(HeaderRowKey, () => row.value);
            const ref = layerRef(engine, "header");
            return () =>
                renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    ...headerRowPartOf(view.value, row.value?.rowIndex ?? -1),
                    ref,
                    drop: LAYER_KEYS,
                    children: () =>
                        slots.default ? slots.default({}) : h(HeaderCells),
                });
        },
    );
