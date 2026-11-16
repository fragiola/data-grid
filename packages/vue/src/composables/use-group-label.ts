import { type GroupLabelState, groupLabelPartOf } from "@fragiola/data-grid";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { type HeaderCellInfo, useRootGrid } from "../context";
import { vueProps } from "../utils/render";
import { layerRef, type PartComposableResult } from "./internal";

/**
 * A group's label (Epic #85, E1.3): the props of an element the app renders inside a group's
 * header cell (its name, its toggle), which stays in view while the group scrolls: sticky in the
 * cell, at the start of the columns that scroll. The engine writes its inline start inset, never
 * Vue: give it no inset of your own. It must be narrower than its cell.
 */
export function useGroupLabel<TRow>(
    cell: MaybeRefOrGetter<HeaderCellInfo<TRow>>,
): PartComposableResult<GroupLabelState> {
    const { engine } = useRootGrid();
    const ref = layerRef(engine, "label");
    const part = computed(() => groupLabelPartOf(toValue(cell)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => ({ ...vueProps(part.value.props), ref })),
    };
}
