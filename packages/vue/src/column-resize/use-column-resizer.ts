import type { ColumnResizerState } from "@fragiola/data-grid";
import { columnResizerPartOf } from "@fragiola/data-grid/column-resize";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type { PartComposableResult } from "../composables/internal";
import { type HeaderCellInfo, useGridView } from "../context";
import { vueProps } from "../utils/render";

/**
 * A column resizer (Epic #70, W3): the state and props of a handle the app renders inside a
 * header cell (a column's, or a group's, which resizes its columns together). The props make it
 * a vertical separator whose values are widths in pixels, marked for the engine, which drags it,
 * resizes with its arrows and fits its columns to their content on a double click or Enter.
 * Its place, look and name (`aria-label`) are the app's: it has no style of its own. Under a cell
 * whose columns do not resize (`state.resizable` false) it has no props: render none there. With
 * `columnResize()` installed (Epic #148): without it, nothing drags it.
 */
export function useColumnResizer<TRow>(
    cell: MaybeRefOrGetter<HeaderCellInfo<TRow>>,
): PartComposableResult<ColumnResizerState> {
    const view = useGridView<TRow>();
    const part = computed(() => columnResizerPartOf(view.value, toValue(cell)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => vueProps(part.value.props)),
    };
}
