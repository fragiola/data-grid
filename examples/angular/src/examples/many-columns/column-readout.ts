import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    type Signal,
} from "@angular/core";
import type { AxisWindow } from "@fragiola/data-grid-angular";
import { formatNumber } from "../_kit/data";
import * as styles from "./styles";

// The column window, read through the grid's ref (`injectColumnWindow(gridRef)` in the example,
// handed here as its signal): this re-renders as it moves, the grid does not.

@Component({
    selector: "example-column-readout",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <p [class]="styles.readout" data-testid="readout">
            <span>
                <span [class]="styles.figure">{{ formatNumber(columns()) }}</span>
                columns
            </span>
            <span>
                in view:
                <span [class]="styles.figure" data-testid="visible-columns">{{ visible() }}</span>
            </span>
            <span>
                rendered:
                <span [class]="styles.figure" data-testid="rendered-columns">{{ rendered() }}</span>
            </span>
        </p>
    `,
})
export class ColumnReadout {
    protected readonly styles = styles;
    protected readonly formatNumber = formatNumber;

    readonly columnWindow = input.required<Signal<AxisWindow>>();
    readonly columns = input.required<number>();

    protected readonly visible = computed(() => {
        const { visible } = this.columnWindow()();
        return `${formatNumber(visible.start + 1)}–${formatNumber(visible.end)}`;
    });
    protected readonly rendered = computed(() => {
        const { rendered } = this.columnWindow()();
        return `${formatNumber(rendered.start + 1)}–${formatNumber(rendered.end)}`;
    });
}
