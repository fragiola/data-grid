import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    type Signal,
} from "@angular/core";
import type { AxisWindow, Range } from "@fragiola/data-grid-angular";
import { formatNumber } from "../_kit/data";
import * as styles from "./styles";

// The grid's size, what is in view and what is rendered, read through its ref
// (`injectRowWindow(gridRef)` and `injectColumnWindow(gridRef)` in the example, handed here as
// their signals): this re-renders as they move, the grid does not.

function span(range: Range) {
    return range.end - range.start;
}

@Component({
    selector: "example-readout",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <p [class]="styles.readout" data-testid="readout">
            <span>
                <span [class]="styles.figure">{{ formatNumber(rows()) }}</span> rows ×
                <span [class]="styles.figure">{{ formatNumber(columns()) }}</span>
                columns =
                <span [class]="styles.figure">{{ formatNumber(rows() * columns()) }}</span>
                cells
            </span>
            <span>
                rows
                <span [class]="styles.figure">{{ inView() }}</span>
                in view
            </span>
            <span>
                rendered:
                <span [class]="styles.figure" data-testid="rendered-cells">{{ rendered() }}</span>
                cells
            </span>
        </p>
    `,
})
export class Readout {
    protected readonly styles = styles;
    protected readonly formatNumber = formatNumber;

    readonly rowWindow = input.required<Signal<AxisWindow>>();
    readonly columnWindow = input.required<Signal<AxisWindow>>();
    readonly rows = input.required<number>();
    readonly columns = input.required<number>();

    protected readonly inView = computed(() => {
        const { visible } = this.rowWindow()();
        return `${formatNumber(visible.start + 1)}–${formatNumber(visible.end)}`;
    });
    protected readonly rendered = computed(() =>
        formatNumber(
            span(this.rowWindow()().rendered) *
                span(this.columnWindow()().rendered),
        ),
    );
}
