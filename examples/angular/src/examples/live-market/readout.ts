import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    input,
    type Signal,
    signal,
} from "@angular/core";
import type { AxisWindow } from "@fragiola/data-grid-angular";
import { formatNumber } from "../_kit/data";
import type { FeedStats, MarketFeed } from "../_kit/market";
import * as styles from "./styles";

// The feed's figures (price changes and frames a second, from the feed twice a second) and the
// cells the grid renders (from its windows, `injectRowWindow(gridRef)` and
// `injectColumnWindow(gridRef)` in the example, handed here as their signals): this re-renders,
// the grid does not. It goes on the app's `<p exampleReadout>`.

@Component({
    selector: "p[exampleReadout]",
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.readout" },
    template: `
        <span>
            <span [class]="styles.liveFigure" data-testid="updates">{{ updates() }}</span>
            updates/s
        </span>
        <span>
            <span [class]="styles.liveFigure" data-testid="fps">{{ stats().framesPerSecond }}</span>
            fps
        </span>
        <span>
            <span [class]="styles.figure">{{ formatNumber(instruments()) }}</span>
            rows
        </span>
        <span>
            rendered:
            <span [class]="styles.figure" data-testid="rendered-cells">{{ rendered() }}</span>
            cells
        </span>
    `,
})
export class Readout {
    protected readonly styles = styles;
    protected readonly formatNumber = formatNumber;

    readonly feed = input.required<MarketFeed>();
    readonly instruments = input.required<number>();
    readonly rowWindow = input.required<Signal<AxisWindow>>();
    readonly columnWindow = input.required<Signal<AxisWindow>>();

    protected readonly stats = signal<FeedStats>({
        updatesPerSecond: 0,
        framesPerSecond: 0,
    });
    protected readonly updates = computed(() =>
        formatNumber(this.stats().updatesPerSecond),
    );
    protected readonly rendered = computed(() => {
        const rows = this.rowWindow()().rendered;
        const columns = this.columnWindow()().rendered;
        return formatNumber(
            (rows.end - rows.start) * (columns.end - columns.start),
        );
    });

    constructor() {
        effect((onCleanup) => {
            onCleanup(this.feed().onStats((stats) => this.stats.set(stats)));
        });
    }
}
