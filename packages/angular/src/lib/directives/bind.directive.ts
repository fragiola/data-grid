import { Directive, input } from "@angular/core";
import type { PartProps } from "@fragiola/data-grid";
import { injectGrid } from "../context";
import { bindPart, injectHost } from "../utils/helpers";

/**
 * Puts a part's props on an element of the app's: `<div [dataGridBind]="cell.props()">`, where
 * `cell = injectCell(…)` (an injection function's `props`). Its attributes, ARIA and `data-*` are
 * written as the directives write theirs, its structural style wins over the element's own (React
 * spreads a hook's props).
 */
@Directive({ selector: "[dataGridBind]" })
export class DataGridBind {
    /** the props (an injection function's `props()`) */
    readonly dataGridBind = input.required<PartProps>();

    constructor() {
        const grid = injectGrid("[dataGridBind]");
        bindPart(
            () => grid.engine,
            injectHost(),
            () => ({ props: this.dataGridBind() }),
        );
    }
}
