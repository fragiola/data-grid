import { computed, Directive, input, type Signal } from "@angular/core";
import {
    type RowDragHandleState,
    rowDragHandlePartOf,
} from "@fragiola/data-grid";
import { injectGrid } from "../context";
import { beforeInputs, bindPart, injectHost } from "../utils/helpers";

/**
 * A row's drag handle (Epic #86), the app's element in a row (a cell of it):
 * `<span [dataGridRowDragHandle]="cell"></span>` (a row's or a cell's info). It drags the row
 * once a press on it moves past a click's slop, while the grid's rows move (`reorderableRows` on
 * the root), it is not sorted and the row is loaded (`state().reorderable`). Its look, cursor and
 * `touch-action: none` are the app's (React's `useRowDragHandle`).
 */
@Directive({
    selector: "[dataGridRowDragHandle]",
    exportAs: "dataGridRowDragHandle",
})
export class DataGridRowDragHandle {
    /** the row (or a cell of it) the handle drags */
    readonly dataGridRowDragHandle = input.required<{
        readonly rowIndex: number;
        readonly loaded: boolean;
    }>();

    private readonly grid = injectGrid("[dataGridRowDragHandle]");
    private readonly part = computed(() =>
        rowDragHandlePartOf(this.grid.view(), this.dataGridRowDragHandle()),
    );

    /** the handle's state (`undefined` on the first pass of a binding on its own element, before its input is set) */
    readonly state: Signal<RowDragHandleState | undefined> = computed(() =>
        beforeInputs(undefined, () => this.part().state),
    );

    constructor() {
        bindPart(
            () => this.grid.engine,
            injectHost(),
            () => ({ props: this.part().props }),
        );
    }
}
