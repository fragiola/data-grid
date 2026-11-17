import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    type Signal,
} from "@angular/core";
import type { AxisWindow, Range } from "@fragiola/data-grid-angular";
import * as styles from "./styles";

// What the grid shows at its size, read through its ref: the windows the engine reports
// (`injectRowWindow(gridRef)` and `injectColumnWindow(gridRef)` in the example, handed here as
// their signals). This re-renders as they change, the grid does not.

function count(range: Range) {
    return range.end - range.start;
}

@Component({
    selector: "example-readout",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <p [class]="styles.readout">
            <span>Drag the grid's bottom corner to resize it.</span>
            <span data-testid="in-view"><span [class]="styles.figure">{{ rows() }}</span> rows × <span [class]="styles.figure">{{ columns() }}</span> columns in view</span>
        </p>
    `,
})
export class Readout {
    protected readonly styles = styles;

    readonly rowWindow = input.required<Signal<AxisWindow>>();
    readonly columnWindow = input.required<Signal<AxisWindow>>();

    protected readonly rows = computed(() => count(this.rowWindow()().visible));
    protected readonly columns = computed(() =>
        count(this.columnWindow()().visible),
    );
}
