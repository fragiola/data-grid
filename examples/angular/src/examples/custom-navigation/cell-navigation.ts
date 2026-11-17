import { Directive, input } from "@angular/core";
import {
    type DataGridFeature,
    injectDataGrid,
    injectGridView,
} from "@fragiola/data-grid-angular";
import type { NavigationTypes } from "@fragiola/data-grid-angular/navigation";
import type { Person } from "../_kit/data";
import { type Mode, target } from "./navigation";

// The keys of a cell (a header cell too), handled before the grid sees them: it goes on the
// cell's own element, `<div [dataGridCell]="cell" [exampleCellNavigation]="mode()">` (React's
// `onKeyDown` on each cell). The grid's keys listen on the root, after the cell's, so
// `preventDefault` here cancels them.

@Directive({
    selector: "[exampleCellNavigation]",
    host: { "(keydown)": "onKeyDown($event)" },
})
export class CellNavigation {
    /** What Tab, and the arrows at a row's ends, do. */
    readonly mode = input.required<Mode>({ alias: "exampleCellNavigation" });

    // the grid's model, typed by the feature this part reads (cell navigation, installed by the grid)

    private readonly grid = injectDataGrid<
        Person,
        [DataGridFeature<NavigationTypes>]
    >();
    private readonly view = injectGridView();

    protected onKeyDown(event: KeyboardEvent): void {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const tab = event.key === "Tab";
        // the arrow toward the row's end: → left to right, ← right to left
        const direction = this.view().direction;
        const forward = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
        const back = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
        if (
            !tab &&
            (event.shiftKey || (event.key !== forward && event.key !== back))
        ) {
            return;
        }
        const { model } = this.grid;
        const active = model.get("active-position");
        if (!active) return;
        const step = (tab ? event.shiftKey : event.key === back) ? -1 : 1;
        const next = target(
            active,
            step,
            tab,
            this.mode(),
            model.get("row-count"),
            model.get("column-count"),
        );
        if (!next) return;
        // the key is ours now: the browser does not move focus, and the grid scrolls the
        // new active cell into view and focuses it
        event.preventDefault();
        model.run("active-position.set", next);
    }
}
