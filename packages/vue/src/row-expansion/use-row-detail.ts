import { type RowDetailState, rowDetailPartOf } from "@fragiola/data-grid";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { type RowInfo, useGridView } from "../context";
import { vueProps } from "../utils/render";
import type { PartComposableResult } from "./internal";

/**
 * A row's detail (M3): its state, and the props for its element (render it only while
 * `state.expanded`). One cell of its row spanning every column, in the row's flow below its
 * cells, sticky at the view's start (the engine writes its `left`), as wide as the visible area.
 */
export function useRowDetail<TRow>(
    row: MaybeRefOrGetter<RowInfo<TRow>>,
): PartComposableResult<RowDetailState> {
    const view = useGridView<TRow>();
    const part = computed(() => rowDetailPartOf(view.value, toValue(row)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => vueProps(part.value.props)),
    };
}
