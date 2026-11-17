import {
    ChangeDetectionStrategy,
    Component,
    computed,
    signal,
} from "@angular/core";
import {
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type ScrollAlign,
} from "@fragiola/data-grid-angular";
import { columnPinning } from "@fragiola/data-grid-angular/column-pinning";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { ClickableButton } from "#/components/atoms/clickable";
import { FIELDS } from "#/components/atoms/fields";
import { formatNumber } from "../_kit/data";
import * as styles from "./styles";

const ROWS = 10_000;
const COLUMNS = 200;

/** A row is only its index: each cell shows its own coordinates. */
interface Row {
    index: number;
}

const getRow = (index: number): Row => ({ index });

const columns: Column<Row, DataGridNode>[] = [
    {
        key: "row",
        name: "Row",
        // the scroll leaves a cell between the pinned columns, never under them
        pinned: "start",
        width: 80,
        renderCell: ({ rowIndex }) => formatNumber(rowIndex),
    },
    ...Array.from(
        { length: COLUMNS - 1 },
        (_, i): Column<Row, DataGridNode> => ({
            key: `c${i + 1}`,
            name: String(i + 1),
            width: 110,
            renderCell: ({ rowIndex }) => `${rowIndex} × ${i + 1}`,
        }),
    ),
];

const ALIGNS: { align: ScrollAlign; label: string }[] = [
    { align: "nearest", label: "Nearest" },
    { align: "start", label: "Start" },
    { align: "center", label: "Centre" },
    { align: "end", label: "End" },
];

/** A whole number within `[0, count)` from a field's text, or `undefined`. */
function indexOf(text: string, count: number): number | undefined {
    const value = Number(text);
    return text.trim() !== "" && Number.isInteger(value) && value >= 0
        ? Math.min(value, count - 1)
        : undefined;
}

// the features the grid installs: cell navigation (the keys, the active cell, the tab stop), pinned
// columns (without it, every column scrolls)
const FEATURES = [navigation(), columnPinning()];

@Component({
    selector: "example-scroll-to-cell",
    imports: [DATA_GRID, ClickableButton, FIELDS],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <kit-input-simple
                    label="Row"
                    inputmode="numeric"
                    [value]="row()"
                    (valueChange)="row.set($event)"
                    [class]="styles.field"
                />
                <kit-input-simple
                    label="Column"
                    inputmode="numeric"
                    [value]="column()"
                    (valueChange)="column.set($event)"
                    [class]="styles.field"
                />
                <fieldset [class]="styles.aligns">
                    <legend [class]="styles.legend">Align</legend>
                    @for (option of aligns; track option.align) {
                        <label [class]="styles.align">
                            <input
                                type="radio"
                                name="align"
                                [value]="option.align"
                                [checked]="align() === option.align"
                                (change)="align.set(option.align)"
                            />
                            {{ option.label }}
                        </label>
                    }
                </fieldset>
            </div>
            <div [class]="styles.toolbar">
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    [disabled]="rowIndex() === undefined || columnIndex() === undefined"
                    (click)="scrollTo({ rowIndex: rowIndex(), columnIndex: columnIndex() })"
                >
                    Scroll to cell
                </button>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    [disabled]="rowIndex() === undefined"
                    (click)="scrollTo({ rowIndex: rowIndex() })"
                >
                    Scroll to row
                </button>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    [disabled]="columnIndex() === undefined"
                    (click)="scrollTo({ columnIndex: columnIndex() })"
                >
                    Scroll to column
                </button>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    [disabled]="rowIndex() === undefined || columnIndex() === undefined"
                    (click)="makeActive()"
                >
                    Make it active
                </button>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [gridRef]="gridRef"
                [columns]="columns"
                [rowCount]="ROWS"
                [getRow]="getRow"
                [rowHeight]="34"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="Coordinates" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" [class]="styles.headerCell">
                                    <ng-container *dataGridCellContent />
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div [dataGridCell]="cell" [class]="styles.cell(cell)">
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
export default class ScrollToCell {
    readonly features = FEATURES;
    protected readonly styles = styles;
    protected readonly ROWS = ROWS;
    protected readonly aligns = ALIGNS;

    readonly columns = columns;
    readonly getRow = getRow;

    // the grid's model and engine from outside its root
    readonly gridRef = createDataGridRef<Row, typeof FEATURES>();
    protected readonly row = signal("5000");
    protected readonly column = signal("120");
    protected readonly align = signal<ScrollAlign>("center");
    protected readonly rowIndex = computed(() => indexOf(this.row(), ROWS));
    protected readonly columnIndex = computed(() =>
        indexOf(this.column(), COLUMNS),
    );

    /** Scrolls one axis, or both: an index left out keeps that axis where it is. */
    protected scrollTo(to: { rowIndex?: number; columnIndex?: number }): void {
        this.gridRef.current?.engine.run("scroll-to-cell", {
            ...to,
            align: this.align(),
        });
    }

    protected makeActive(): void {
        const rowIndex = this.rowIndex();
        const columnIndex = this.columnIndex();
        if (rowIndex === undefined || columnIndex === undefined) return;
        // a command, not a screen action: the grid scrolls the active cell into view (the
        // nearest edge) and, holding focus, focuses it
        this.gridRef.current?.model.run("active-position.set", {
            rowIndex,
            columnIndex,
        });
    }
}
