import { Directive } from "@angular/core";
import { headerPropsOf } from "@fragiola/data-grid";
import { injectGrid } from "../context";
import { bindPart } from "../utils/helpers";
import { structuralView } from "../utils/structural";

/**
 * The header (`role="rowgroup"`): sticky at the viewport's top, as tall as its header rows, above
 * the rows scrolling under it and the summary rows (a structural `z-index`):
 * `<div *dataGridHeader>`, or `<thead *dataGridHeader>`. Nothing renders without a header. Its
 * rows: `<ng-template dataGridHeaderRows let-row>`. Its background is the consumer's.
 */
@Directive({ selector: "ng-template[dataGridHeader]" })
export class DataGridHeader {
    constructor() {
        const grid = injectGrid("*dataGridHeader");
        const element = structuralView(() =>
            grid.view().headerRowCount > 0 ? {} : null,
        );
        bindPart(
            () => grid.engine,
            element,
            () => ({ props: headerPropsOf(grid.view()) }),
        );
    }
}
