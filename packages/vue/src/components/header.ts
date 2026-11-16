import { headerPropsOf } from "@fragiola/data-grid";
import { h } from "vue";
import { useGridView } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";
import { HeaderRows } from "./header-rows";

export type HeaderProps = PrimitiveProps;

export interface HeaderSlots extends RenderSlot<Record<string, never>> {
    /** without it, a header row per level (`DataGrid.HeaderRows`) */
    default?: SlotFunction<Record<never, never>>;
}

/**
 * The header (`role="rowgroup"`): sticky at the viewport's top, as tall as its header rows, above
 * the rows scrolling under it and the summary rows (a structural `z-index`). A `<thead>` with
 * `as="thead"`. Nothing renders without a header. Its background is the consumer's: give it one
 * so the rows are hidden under it.
 */
export const Header: DataGridComponent<HeaderProps, HeaderSlots> =
    definePrimitive<HeaderProps, HeaderSlots>(
        "Header",
        ["as"],
        (props, { attrs, slots }) => {
            const view = useGridView();
            return () =>
                view.value.headerRowCount > 0
                    ? renderElement({
                          tag: "div",
                          as: props.as,
                          attrs,
                          render: slots.render,
                          state: {},
                          props: headerPropsOf(view.value),
                          children: () =>
                              slots.default ? slots.default({}) : h(HeaderRows),
                      })
                    : null;
        },
    );
