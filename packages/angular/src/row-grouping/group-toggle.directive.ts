import { computed, Directive, input } from "@angular/core";
import {
    type GroupToggleState,
    groupTogglePartOf,
    type RowMeta,
} from "@fragiola/data-grid";
import { injectGrid } from "../context";
import { bindPart } from "../utils/helpers";
import { structuralView } from "../utils/structural";

/** The context of the `*dataGridGroupToggle` template. */
export interface GroupToggleContext {
    /** the toggle's state (`let state`) */
    $implicit: GroupToggleState;
    state: GroupToggleState;
}

/**
 * A row group's toggle (Epic #87), the app's control in a group row (or a row that expands):
 * `<button *dataGridGroupToggle="cell; let state" aria-label="Expand">…</button>` (a row's or a
 * cell's info). It renders only in a row that expands; a click on it runs `row-groups.toggle`
 * (the engine's, after the app's own listener). Its element, name, look and place are the app's
 * (React's `useGroupToggle`).
 */
@Directive({ selector: "ng-template[dataGridGroupToggle]" })
export class DataGridGroupToggle {
    /** the row (or a cell of it) it expands */
    readonly dataGridGroupToggle = input.required<{
        readonly rowIndex: number;
        readonly meta?: RowMeta | undefined;
    }>();

    static ngTemplateContextGuard(
        _directive: DataGridGroupToggle,
        _context: unknown,
    ): _context is GroupToggleContext {
        return true;
    }

    constructor() {
        const grid = injectGrid("*dataGridGroupToggle");
        const part = computed(() =>
            groupTogglePartOf(grid.view(), this.dataGridGroupToggle()),
        );
        const element = structuralView<GroupToggleContext>(() => {
            const { state } = part();
            return state.expandable ? { $implicit: state, state } : null;
        });
        bindPart(
            () => grid.engine,
            element,
            () => ({ props: part().props }),
        );
    }
}
