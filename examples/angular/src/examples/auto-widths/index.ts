import {
    ChangeDetectionStrategy,
    Component,
    computed,
    signal,
} from "@angular/core";
import {
    type Column,
    type ColumnWidths,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type HeaderCellInfo,
} from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { LucideRotateCcw, LucideWandSparkles } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { formatMoney, type Person, people } from "../_kit/data";
import { injectAutoWidths } from "./inject-auto-widths";
import * as styles from "./styles";

const rows = people(1_000);

// Name fits its content once, when its first rows render (`autoSize`). Email and City share what
// the other columns leave of the grid's width, two parts and one, never below their `width` (City
// at most 240px). Every column but "#" resizes: a person's width replaces the automatic one.
const columns: Column<Person, DataGridNode>[] = [
    { key: "id", name: "#", width: 64, meta: { numeric: true } },
    {
        key: "name",
        name: "Name",
        width: 140,
        autoSize: true,
        resizable: true,
        minWidth: 120,
    },
    {
        key: "email",
        name: "Email",
        width: 220,
        flex: 2,
        resizable: true,
        minWidth: 160,
    },
    {
        key: "city",
        name: "City",
        width: 120,
        flex: 1,
        resizable: true,
        maxWidth: 240,
    },
    { key: "team", name: "Team", width: 140, resizable: true },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        resizable: true,
        minWidth: 90,
        renderCell: ({ row }) => formatMoney(row.salary),
        meta: { numeric: true },
    },
];

const NAMES = new Map(columns.map((column) => [column.key, column.name]));

/** `{ email: 310 }` → `Email 310px`, in the columns' order. */
function describe(widths: ColumnWidths): string {
    return columns
        .flatMap((column) => {
            const width = widths[column.key];
            return width === undefined
                ? []
                : [`${NAMES.get(column.key)} ${width}px`];
        })
        .join(" · ");
}

// Each header cell renders its own content, then its handle: `*dataGridColumnResizer` on an
// element of the app's (none under a column that does not resize). Its props make it a
// separator, a focusable one (the APG's splitter), which an <hr> cannot be.

@Component({
    selector: "example-auto-widths",
    imports: [DATA_GRID, ClickableButton, LucideRotateCcw, LucideWandSparkles],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <label [class]="styles.slider">
                    Grid width
                    <input
                        type="range"
                        min="50"
                        max="100"
                        step="5"
                        [value]="share()"
                        (input)="setShare($event)"
                        [class]="styles.range"
                    />
                    <span [class]="styles.sliderValue">{{ share() }}%</span>
                </label>
                <span>
                    A double click on a handle (or
                    <kbd [class]="styles.key">F2</kbd>, then
                    <kbd [class]="styles.key">Enter</kbd>) fits its column
                </span>
                <span [class]="styles.buttons">
                    <!-- every rendered resizable column, measured, in one change -->
                    <button kitClickable size="sm" variant="outline" (click)="fitAll()">
                        <svg lucideWandSparkles aria-hidden="true"></svg>
                        Fit all
                    </button>
                    <!-- back to the grid's widths: Name's fit, the flex shares, the others' own -->
                    <button
                        kitClickable
                        size="sm"
                        variant="outline"
                        [disabled]="resetDisabled()"
                        (click)="widths.set({})"
                    >
                        <svg lucideRotateCcw aria-hidden="true"></svg>
                        Reset widths
                    </button>
                </span>
            </div>
            <div [class]="styles.readouts">
                <span [class]="styles.readout" data-testid="auto-widths">{{ byTheGrid() }}</span>
                <span [class]="styles.readout" data-testid="widths">{{ byAPerson() }}</span>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [columnWidths]="widths()"
                (columnWidthsChange)="widths.set($event)"
                [gridRef]="gridRef"
                [class]="styles.root"
                [style.width.%]="share()"
            >
                <div dataGridGrid aria-label="People" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" [class]="styles.headerCell">
                                    <!-- its own content, then its handle -->
                                    <ng-container *dataGridCellContent />
                                    <div
                                        *dataGridColumnResizer="cell"
                                        [attr.aria-label]="resizeLabel(cell)"
                                        [class]="styles.resizer"
                                    ></div>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div
                                        [dataGridCell]="cell"
                                        [class]="cell.column.meta?.numeric ? styles.numeric : styles.cell"
                                    >
                                        <ng-container *dataGridCellContent />
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class AutoWidths {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;

    readonly rows = rows;
    readonly columns = columns;
    readonly rowKey = (row: Person) => row.id;

    // the grid sizes Name, Email and City itself; the app keeps only what a person sets
    readonly widths = signal<ColumnWidths>({});
    // the grid's width, as a share of the frame: flex columns follow it
    readonly share = signal(100);
    readonly gridRef = createDataGridRef<Person>();
    readonly automatic = injectAutoWidths(this.gridRef);

    protected readonly byTheGrid = computed(
        () => `By the grid: ${describe(this.automatic()) || "none"}`,
    );
    protected readonly byAPerson = computed(
        () => `Set by a person: ${describe(this.widths()) || "none"}`,
    );

    protected resetDisabled(): boolean {
        return Object.keys(this.widths()).length === 0;
    }

    protected setShare(event: Event): void {
        this.share.set(Number((event.target as HTMLInputElement).value));
    }

    protected fitAll(): void {
        this.gridRef.current?.engine.run("fit-columns", {});
    }

    protected resizeLabel(cell: HeaderCellInfo<Person>): string {
        return `Resize ${cell.column?.name ?? cell.key}`;
    }
}
