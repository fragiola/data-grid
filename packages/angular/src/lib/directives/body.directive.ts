import { Directive } from "@angular/core";
import { bodyPropsOf, LAYER_KEYS } from "@fragiola/data-grid";
import { injectGrid } from "../context";
import { bindPart, injectHost } from "../utils/helpers";

/**
 * The body (`role="rowgroup"`), the layer the engine moves with the rows, below the header and the
 * top summary rows: `<div dataGridBody>`, or `<tbody dataGridBody>`. Its rows are the app's
 * (`<ng-template dataGridRows let-row>`); its `transform` is the engine's.
 */
@Directive({ selector: "[dataGridBody]", exportAs: "dataGridBody" })
export class DataGridBody {
    constructor() {
        const grid = injectGrid("[dataGridBody]");
        bindPart(
            () => grid.engine,
            injectHost(),
            () => ({
                props: bodyPropsOf(grid.view()),
                layer: "body",
                drop: LAYER_KEYS,
            }),
        );
    }
}
