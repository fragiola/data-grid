import { type RowState, rowPartOf } from "@fragiola/data-grid";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { type RowInfo, useGridView, useRootGrid } from "../context";
import { vueProps } from "../utils/render";
import { layerRef, type PartComposableResult } from "./internal";

/**
 * A body row's state, and the props for its element (ARIA, `data-*`, structural style). A row
 * measured (`rowHeight: "auto"`) has a `ref` among them too: the engine reads its height.
 */
export function useRow<TRow>(
    row: MaybeRefOrGetter<RowInfo<TRow>>,
): PartComposableResult<RowState> {
    const view = useGridView<TRow>();
    const { engine } = useRootGrid();
    // a measured row's height is read by the engine (Epic #86): one ref for the component's life
    const ref = layerRef(engine, "row");
    const part = computed(() => rowPartOf(view.value, toValue(row)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => {
            const { props, measured } = part.value;
            return measured ? { ...vueProps(props), ref } : vueProps(props);
        }),
    };
}
