import type { RowMeta } from "@fragiola/data-grid";
import {
    type GroupToggleState,
    groupTogglePartOf,
} from "@fragiola/data-grid/row-grouping";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type { PartComposableResult } from "../composables/internal";
import { useGridView } from "../context";
import { vueProps } from "../utils/render";

/**
 * A row group's toggle (Epic #87): the state and props of a control the app renders in a group
 * row (or a row that expands; `row` is a row's or a cell's info), which expands and collapses it:
 * a click on it runs `row-groups.toggle` (the engine's, after the app's own listener). Its element
 * (a `button`), name, look and place are the app's. Under a row that does not expand
 * (`state.expandable` false) it has no props: render none there.
 */
export function useGroupToggle(
    row: MaybeRefOrGetter<{
        readonly rowIndex: number;
        /** the row's kind as read (a row's or a cell's info carries it): not read again */
        readonly meta?: RowMeta | undefined;
    }>,
): PartComposableResult<GroupToggleState> {
    const view = useGridView();
    const part = computed(() => groupTogglePartOf(view.value, toValue(row)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => vueProps(part.value.props)),
    };
}
