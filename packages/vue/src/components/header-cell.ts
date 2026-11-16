import {
    type HeaderCellState,
    headerCellContent,
    headerCellPartOf,
} from "@fragiola/data-grid";
import { layerRef } from "../composables/internal";
import { type HeaderCellInfo, useGridView, useRootGrid } from "../context";
import { renderCellElement } from "../utils/cell-element";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import type { RenderSlot } from "../utils/render";

export interface HeaderCellProps<TRow = unknown> extends PrimitiveProps {
    cell: HeaderCellInfo<TRow>;
}

export interface HeaderCellSlots extends RenderSlot<HeaderCellState> {
    /** without it: the group's or the column's `renderHeaderCell`, else its `name` */
    default?: SlotFunction<{ state: HeaderCellState }>;
}

/**
 * A header cell (`role="columnheader"`), a group's or a column's. A `<th>` with `as="th"`, which
 * then gets `colSpan`/`rowSpan` too (a `render` slot finds them in the state, and in its props'
 * `aria-colspan`/`aria-rowspan`).
 */
export const HeaderCell: DataGridComponent<HeaderCellProps, HeaderCellSlots> =
    definePrimitive<HeaderCellProps, HeaderCellSlots>(
        "HeaderCell",
        ["cell", "as"],
        (props, { attrs, slots }) => {
            const { engine } = useRootGrid();
            const view = useGridView();
            const pinnedRef = layerRef(engine, "pinned");
            return () => {
                const { cell } = props;
                const own = headerCellPartOf(view.value, cell);
                return renderCellElement({
                    as: props.as,
                    attrs,
                    render: slots.render,
                    own,
                    pinnedRef,
                    content: () =>
                        slots.default
                            ? slots.default({ state: own.state })
                            : headerCellContent(cell),
                    columnSpan: cell.columnSpan,
                    measured: false,
                    rowSpan: cell.rowSpan,
                });
            };
        },
    );
