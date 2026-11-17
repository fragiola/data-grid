import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import {
    type CellRange,
    type Column,
    DATA_GRID,
    type DataGridNode,
    type RangeFill,
} from "@fragiola/data-grid-angular";
import { columnPinning } from "@fragiola/data-grid-angular/column-pinning";
import {
    DataGridFill,
    DataGridFillHandle,
    fillHandle,
    repeatedFill,
} from "@fragiola/data-grid-angular/fill";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import {
    cellRange,
    DataGridCellRange,
} from "@fragiola/data-grid-angular/range";
import { ClickableButton } from "#/components/atoms/clickable";
import { hash } from "../_kit/data";
import * as styles from "./styles";

// A shipping plan: units per product and week. A range's corner holds a handle; dragging it down
// or across fills the cells it reaches. The grid tells the fill; the app makes the values: the
// source repeated, or its series continued.

interface Plan {
    id: number;
    product: string;
    /** units shipped each week, the first week first */
    weeks: readonly number[];
}

const WEEKS = 10;

const PRODUCTS = ["Chairs", "Desks", "Lamps", "Shelves", "Monitors", "Cables"];

const initialPlans: Plan[] = Array.from({ length: 40 }, (_, index) => ({
    id: index + 1,
    product: `${PRODUCTS[index % PRODUCTS.length]} ${Math.floor(index / PRODUCTS.length) + 1}`,
    weeks: Array.from({ length: WEEKS }, (_, week) =>
        week < 3 ? 10 * (1 + hash(index * 11 + week, 20)) : 0,
    ),
}));

/** How a fill fills: the source repeated, or each line's series continued. */
type Mode = "repeat" | "series";

const MODES: readonly Mode[] = ["repeat", "series"];

const columns: Column<Plan, DataGridNode>[] = [
    { key: "product", name: "Product", width: 160, pinned: "start" },
    ...Array.from(
        { length: WEEKS },
        (_, week): Column<Plan, DataGridNode> => ({
            key: `w${week}`,
            name: `Week ${week + 1}`,
            width: 92,
            getValue: (plan) => plan.weeks[week] ?? 0,
        }),
    ),
];

/**
 * Each line of the source continued (a series): along a fill down, each column's last two values
 * give the step; across, each row's. One value repeats.
 */
function seriesFill(
    { source, target }: RangeFill,
    valueAt: (rowIndex: number, columnIndex: number) => number,
) {
    const down = target.anchor.rowIndex > source.focus.rowIndex;
    const cells: { rowIndex: number; columnIndex: number; value: number }[] =
        [];
    for (
        let row = target.anchor.rowIndex;
        row <= target.focus.rowIndex;
        row++
    ) {
        for (
            let column = target.anchor.columnIndex;
            column <= target.focus.columnIndex;
            column++
        ) {
            const last = down
                ? valueAt(source.focus.rowIndex, column)
                : valueAt(row, source.focus.columnIndex);
            const before = down
                ? source.focus.rowIndex > source.anchor.rowIndex
                    ? valueAt(source.focus.rowIndex - 1, column)
                    : last
                : source.focus.columnIndex > source.anchor.columnIndex
                  ? valueAt(row, source.focus.columnIndex - 1)
                  : last;
            const steps = down
                ? row - source.focus.rowIndex
                : column - source.focus.columnIndex;
            cells.push({
                rowIndex: row,
                columnIndex: column,
                value: Math.max(0, last + (last - before) * steps),
            });
        }
    }
    return cells;
}

/** A range from the first week column on (the product column is no units). */
function weeksOf(range: CellRange): CellRange {
    return {
        anchor: {
            rowIndex: range.anchor.rowIndex,
            columnIndex: Math.max(1, range.anchor.columnIndex),
        },
        focus: range.focus,
    };
}

/**
 * The fill of the units: its source and its target from the first week on, `null` for a source
 * holding only the product (no units to fill from).
 */
function unitsFill({ source, target }: RangeFill): RangeFill | null {
    return source.focus.columnIndex < 1
        ? null
        : { source: weeksOf(source), target: weeksOf(target) };
}

// Each cell draws its handle: `*dataGridFillHandle` on an element of the app's, which gives it its
// place at the corner and its look. It renders only in the cell at the range's corner.

@Component({
    selector: "example-fill",
    imports: [
        DATA_GRID,
        ClickableButton,
        DataGridCellRange,
        DataGridFill,
        DataGridFillHandle,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span>Drag the square at a range's corner down or across. A fill</span>
                <div [class]="styles.modes">
                    @for (option of modes; track option) {
                        <button
                            kitClickable
                            size="sm"
                            [variant]="mode() === option ? 'solid' : 'outline'"
                            [attr.aria-pressed]="mode() === option"
                            (click)="mode.set(option)"
                        >
                            {{ option === "repeat" ? "repeats" : "continues a series" }}
                        </button>
                    }
                </div>
                <!-- the app's live region: a polite status, its text the app's own -->
                <span role="status" [class]="styles.status">{{ announcement() }}</span>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rows]="plans()"
                [rowKey]="rowKey"
                [rowHeight]="36"
                dataGridCellRange
                cellSelection="range"
                dataGridFill
                (fill)="fill($event)"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="Shipping plan" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" [class]="styles.headerCell(cell)">
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
                                        {{ cell.value ?? "" }}
                                        <span
                                            *dataGridFillHandle="cell; let state"
                                            aria-hidden="true"
                                            [class]="styles.handle(state)"
                                        ></span>
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
export default class Fill {
    // the features the grid installs: cell navigation (the keys, the active cell, the tab stop),
    // ranges of cells, the fill handle, pinned columns (without it, every column scrolls)
    readonly features = [
        navigation(),
        cellRange(),
        fillHandle(),
        columnPinning(),
    ];
    protected readonly styles = styles;
    protected readonly modes = MODES;
    readonly columns = columns;

    // the app's rows: the grid never writes them, a fill is told
    readonly plans = signal<readonly Plan[]>(initialPlans);
    readonly mode = signal<Mode>("repeat");
    readonly announcement = signal("");

    readonly rowKey = (plan: Plan) => plan.id;

    /** a week cell's units, from the app's rows */
    private readonly unitsAt = (rowIndex: number, columnIndex: number) =>
        this.plans()[rowIndex]?.weeks[columnIndex - 1] ?? 0;

    protected fill(filled: RangeFill) {
        // the units only: the product's name is neither filled nor filled from
        const units = unitsFill(filled);
        if (!units) return;
        const cells =
            this.mode() === "series"
                ? seriesFill(units, this.unitsAt)
                : repeatedFill(units, (at) =>
                      this.unitsAt(at.rowIndex, at.columnIndex),
                  );
        this.plans.update((current) =>
            current.map((plan, rowIndex) => {
                const mine = cells.filter((cell) => cell.rowIndex === rowIndex);
                if (mine.length === 0) return plan;
                const weeks = [...plan.weeks];
                for (const cell of mine) {
                    weeks[cell.columnIndex - 1] = Number(cell.value);
                }
                return { ...plan, weeks };
            }),
        );
        this.announcement.set(
            `Filled ${cells.length} ${cells.length === 1 ? "cell" : "cells"}.`,
        );
    }
}
