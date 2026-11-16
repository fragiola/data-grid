import { type HeaderCellState, headerCellPartOf } from "@fragiola/data-grid";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { type HeaderCellInfo, useGridView } from "../context";
import { vueProps } from "../utils/render";
import type { PartComposableResult } from "./internal";

/** A header cell's state, and the props for its element. */
export function useHeaderCell<TRow>(
    cell: MaybeRefOrGetter<HeaderCellInfo<TRow>>,
): PartComposableResult<HeaderCellState> {
    const view = useGridView<TRow>();
    const part = computed(() => headerCellPartOf(view.value, toValue(cell)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => vueProps(part.value.props)),
    };
}
