import { computed, Directive, input, type Signal } from "@angular/core";
import { type GroupLabelState, groupLabelPartOf } from "@fragiola/data-grid";
import { type HeaderCellInfo, injectGrid } from "../context";
import { bindPart, injectHost } from "../utils/helpers";

/**
 * A group's label (Epic #85, E1.3), the app's element inside a group's header cell (its name, its
 * toggle), which stays in view while the group scrolls: `<span [dataGridGroupLabel]="cell">`,
 * sticky in the cell, at the start of the columns that scroll. The engine writes its inline start
 * inset: give it no inset of your own. It must be narrower than its cell (React's `useGroupLabel`).
 */
@Directive({
    selector: "[dataGridGroupLabel]",
    exportAs: "dataGridGroupLabel",
})
export class DataGridGroupLabel<TRow = unknown> {
    /** the group's header cell */
    readonly dataGridGroupLabel = input.required<HeaderCellInfo<TRow>>();

    private readonly part = computed(() =>
        groupLabelPartOf(this.dataGridGroupLabel()),
    );

    /** the label's state: its group's key */
    readonly state: Signal<GroupLabelState> = computed(() => this.part().state);

    constructor() {
        const grid = injectGrid("[dataGridGroupLabel]");
        bindPart(
            () => grid.engine,
            injectHost(),
            () => ({ props: this.part().props, layer: "label" }),
        );
    }
}
