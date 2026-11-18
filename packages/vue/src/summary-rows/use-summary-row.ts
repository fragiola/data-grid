import type { SummaryRowState } from "@fragiola/data-grid";
import { summaryRowPartOf } from "@fragiola/data-grid/summary-rows";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import type { PartComposableResult } from "../composables/internal";
import { useGridView } from "../context";
import { vueProps } from "../utils/render";
import type { SummaryRowInfo } from "./info";

/**
 * A summary row's state, and the props for its element (Epic #86): ARIA (`role="row"`, its
 * `aria-rowindex`), `data-summary`, and its structural style in its `DataGrid.Summary`.
 */
export function useSummaryRow<TRow>(
    row: MaybeRefOrGetter<SummaryRowInfo>,
): PartComposableResult<SummaryRowState> {
    const view = useGridView<TRow>();
    const part = computed(() => summaryRowPartOf(view.value, toValue(row)));
    return {
        state: computed(() => part.value.state),
        props: computed(() => vueProps(part.value.props)),
    };
}
