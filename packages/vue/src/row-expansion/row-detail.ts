import { PINNED_KEYS } from "@fragiola/data-grid";
import {
    type RowDetailState,
    rowDetailPartOf,
} from "@fragiola/data-grid/row-expansion";
import { layerRef } from "../composables/internal";
import { useGridView, useRootGrid, useRowContext } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import {
    type RenderSlot,
    renderElement,
    withTableSpans,
} from "../utils/render";

export type RowDetailProps = PrimitiveProps;

export interface RowDetailSlots extends RenderSlot<RowDetailState> {
    /** what the detail holds: another grid, a summary, controls (the app's own content) */
    default?: SlotFunction<{ state: RowDetailState }>;
}

/**
 * An expanded row's detail (M3): inside its `Row`, after its cells, below the row's own height;
 * as wide as the visible area and in view while the grid scrolls sideways (sticky, the engine
 * writes its `left`). It renders only while its row is expanded, and holds only its slot: no text
 * and no names. One cell of its row spanning every column (`role="gridcell"`). A `<td>` with
 * `as="td"`, which then gets `colSpan`.
 */
export const RowDetail: DataGridComponent<RowDetailProps, RowDetailSlots> =
    definePrimitive<RowDetailProps, RowDetailSlots>(
        "RowDetail",
        ["as"],
        (props, { attrs, slots }) => {
            const row = useRowContext("RowDetail");
            const { engine } = useRootGrid();
            const view = useGridView();
            const ref = layerRef(engine, "detail");
            return () => {
                const own = rowDetailPartOf(view.value, row());
                if (!own.state.expanded) return null;
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: own.state,
                    props: withTableSpans(
                        own.props,
                        props.as,
                        view.value.columnCount,
                    ),
                    ref,
                    // its inset is the engine's, and the other insets would move it
                    drop: PINNED_KEYS,
                    children: () => slots.default?.({ state: own.state }),
                });
            };
        },
    );
