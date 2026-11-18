import { computed, Directive } from "@angular/core";
import {
    PINNED_KEYS,
    type RowDetailState,
    rowDetailPartOf,
} from "@fragiola/data-grid";
import { injectGrid, injectRowContext } from "../context";
import { withTableSpans } from "../utils/cell-binding";
import { bindPart } from "../utils/helpers";
import { structuralView } from "../utils/structural";

/** The context of the `*dataGridRowDetail` template. */
export interface RowDetailContext {
    /** the detail's state (`let state`) */
    $implicit: RowDetailState;
    state: RowDetailState;
}

/**
 * An expanded row's detail (M3): `<div *dataGridRowDetail>…</div>` inside its `[dataGridRow]`,
 * after its cells, below the row's own height; as wide as the visible area and in view while the
 * grid scrolls sideways (sticky, the engine writes its inset). It renders only while its row is
 * expanded, and holds only its content: no text and no names. One cell of its row spanning every
 * column (`role="gridcell"`); a `<td>` gets `colspan`.
 */
@Directive({ selector: "ng-template[dataGridRowDetail]" })
export class DataGridRowDetail {
    static ngTemplateContextGuard(
        _directive: DataGridRowDetail,
        _context: unknown,
    ): _context is RowDetailContext {
        return true;
    }

    constructor() {
        const grid = injectGrid("*dataGridRowDetail");
        const row = injectRowContext("*dataGridRowDetail");
        const part = computed(() =>
            rowDetailPartOf(grid.view(), row.rowInfo()),
        );
        const element = structuralView<RowDetailContext>(() => {
            const { state } = part();
            return state.expanded ? { $implicit: state, state } : null;
        });
        bindPart(
            () => grid.engine,
            element,
            () => {
                const host = element();
                if (!host) return null;
                return {
                    props: withTableSpans(
                        host,
                        part().props,
                        grid.view().columnCount,
                    ),
                    layer: "detail",
                    // its inset is the engine's, and the other insets would move it
                    drop: PINNED_KEYS,
                };
            },
        );
    }
}
