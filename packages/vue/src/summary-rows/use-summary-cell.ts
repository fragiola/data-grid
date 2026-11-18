import type { SummaryCellState } from "@fragiola/data-grid";
import { summaryCellPartOf } from "@fragiola/data-grid/summary-rows";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type { PartComposableResult } from "../composables/internal";
import { useGridView } from "../context";
import { vueProps } from "../utils/render";
import type { SummaryCellInfo } from "./info";

/**
 * A summary row's cell's state, and the props for its element (Epic #86): a body cell's (the
 * roving tab stop, ARIA, pinned and spanning as one), `data-summary`, a summary row tall.
 */
export function useSummaryCell<TRow>(
    cell: MaybeRefOrGetter<SummaryCellInfo<TRow>>,
): PartComposableResult<SummaryCellState> {
    const view = useGridView<TRow>();
    const part = computed(() => summaryCellPartOf(view.value, toValue(cell)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => vueProps(part.value.props)),
    };
}
