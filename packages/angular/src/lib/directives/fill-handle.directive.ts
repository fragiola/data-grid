import { computed, Directive, input } from "@angular/core";
import { type FillHandleState, fillHandlePartOf } from "@fragiola/data-grid";
import { injectGrid } from "../context";
import { bindPart } from "../utils/helpers";
import { structuralView } from "../utils/structural";

/** The context of the `*dataGridFillHandle` template. */
export interface FillHandleContext {
    /** the handle's state (`let state`) */
    $implicit: FillHandleState;
    state: FillHandleState;
}

/**
 * A fill handle (Epic #88, E4.4), the app's element in a cell: `<span *dataGridFillHandle="cell">
 * </span>` (a cell's info, or its position). It renders only in the cell at the corner a fill
 * drags from, while cells fill (`fillable` on the root) and none is edited. Its look, place at the
 * corner, cursor and `touch-action: none` are the app's (React's `useFillHandle`).
 */
@Directive({ selector: "ng-template[dataGridFillHandle]" })
export class DataGridFillHandle {
    /** the cell it is in */
    readonly dataGridFillHandle = input.required<{
        readonly rowIndex: number;
        readonly columnIndex: number;
    }>();

    static ngTemplateContextGuard(
        _directive: DataGridFillHandle,
        _context: unknown,
    ): _context is FillHandleContext {
        return true;
    }

    constructor() {
        const grid = injectGrid("*dataGridFillHandle");
        const part = computed(() =>
            fillHandlePartOf(grid.view(), this.dataGridFillHandle()),
        );
        const element = structuralView<FillHandleContext>(() => {
            const { state } = part();
            return state.visible ? { $implicit: state, state } : null;
        });
        bindPart(
            () => grid.engine,
            element,
            () => ({ props: part().props }),
        );
    }
}
