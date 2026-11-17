import { computed, Directive, input } from "@angular/core";
import {
    type FillHandleState,
    fillHandlePartOf,
} from "@fragiola/data-grid/fill";
import {
    injectDataGrid,
    injectGridView,
    ɵbindPart,
    ɵstructuralView,
} from "@fragiola/data-grid-angular";

/** The context of the `*dataGridFillHandle` template. */
export interface FillHandleContext {
    /** the handle's state (`let state`) */
    $implicit: FillHandleState;
    state: FillHandleState;
}

/**
 * A fill handle (Epic #88, E4.4), the app's element in a cell: `<span *dataGridFillHandle="cell">
 * </span>` (a cell's info, or its position). It renders only in the cell at the corner a fill
 * drags from, while cells fill (`fillHandle()` installed, `dataGridFill` on the root) and none is
 * edited. Its look, place at the corner, cursor and `touch-action: none` are the app's (React's
 * `useFillHandle`).
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
        const grid = injectDataGrid();
        const view = injectGridView();
        const part = computed(() =>
            fillHandlePartOf(view(), this.dataGridFillHandle()),
        );
        const element = ɵstructuralView<FillHandleContext>(() => {
            const { state } = part();
            return state.visible ? { $implicit: state, state } : null;
        });
        ɵbindPart(
            () => grid.engine,
            element,
            () => ({ props: part().props }),
        );
    }
}
