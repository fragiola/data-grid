import { type CellState, cellPartOf } from "@fragiola/data-grid";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { type CellInfo, useGridView } from "../context";
import { vueProps } from "../utils/render";
import type { PartComposableResult } from "./internal";

/**
 * A body cell's state, and the props for its element: the roving tab stop, ARIA, `data-*`. A cell
 * spanning columns (Epic #85) is as wide as them, with `aria-colspan`.
 */
export function useCell<TRow>(
    cell: MaybeRefOrGetter<CellInfo<TRow>>,
): PartComposableResult<CellState> {
    const view = useGridView<TRow>();
    const part = computed(() => cellPartOf(view.value, toValue(cell)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => vueProps(part.value.props)),
    };
}
