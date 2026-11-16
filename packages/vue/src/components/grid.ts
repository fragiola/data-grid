import { type GridState, gridPartOf } from "@fragiola/data-grid";
import { onMounted, onUpdated, provide } from "vue";
import { layerRef } from "../composables/internal";
import { TableKey, useGridView, useRootGrid } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export type { GridState } from "@fragiola/data-grid";

export type GridProps = PrimitiveProps;

export interface GridSlots extends RenderSlot<GridState> {
    default?: SlotFunction<Record<never, never>>;
}

/**
 * The grid (`role="grid"`; `treegrid` when its rows have kinds, Epic #87: `getRowMeta` on the
 * root) and the sizer: as large as the whole dataset (the physical size, under scroll scaling), so
 * the scrollbars represent it. A `<table>` with `as="table"`, whose parts then take a table's
 * structure. It is the grid's tab stop while no cell is active.
 */
export const Grid: DataGridComponent<GridProps, GridSlots> = definePrimitive<
    GridProps,
    GridSlots
>("Grid", ["as"], (props, { attrs, slots }) => {
    const { engine } = useRootGrid();
    const view = useGridView();
    const ref = layerRef(engine, "grid");
    // a `<table>`: what it holds takes a table's structure (`Empty`)
    provide(TableKey, props.as === "table");
    // the view is on screen: the engine writes the layers' offsets for it and moves focus
    let committed: unknown = null;
    const commit = () => {
        if (committed === view.value) return;
        committed = view.value;
        engine.adapter.commit(view.value);
    };
    onMounted(commit);
    onUpdated(commit);
    return () =>
        renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            ...gridPartOf(view.value),
            ref,
            children: () => slots.default?.({}),
        });
});
