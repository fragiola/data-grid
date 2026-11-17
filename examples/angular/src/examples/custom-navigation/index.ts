import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { type Person, people } from "../_kit/data";
import { CellNavigation } from "./cell-navigation";
import type { Mode } from "./navigation";
import * as styles from "./styles";

// React Data Grid's cell navigation modes: each cell (header cells too) handles Tab and the
// arrows at a row's ends before the grid sees them (`cell-navigation.ts`), from the mode chosen.

const rows = people(1_000);

const columns: Column<Person, DataGridNode>[] = [
    { key: "id", name: "#", width: 72 },
    { key: "name", name: "Name", width: 180 },
    { key: "city", name: "City", width: 140 },
    { key: "team", name: "Team", width: 120 },
];

const MODES: { mode: Mode; label: string }[] = [
    { mode: "leave", label: "Tab leaves the grid" },
    {
        mode: "change-row",
        label: "Tab and the arrows go on to the next row",
    },
    { mode: "loop-over-row", label: "Tab and the arrows loop over the row" },
    { mode: "loop-over-column", label: "Tab moves down the column" },
];

@Component({
    selector: "example-custom-navigation",
    imports: [DATA_GRID, CellNavigation],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <fieldset [class]="styles.modes">
                <legend [class]="styles.panel">Cell navigation</legend>
                @for (option of modes; track option.mode) {
                    <label [class]="styles.mode">
                        <input
                            type="radio"
                            name="navigation-mode"
                            [value]="option.mode"
                            [checked]="mode() === option.mode"
                            (change)="mode.set(option.mode)"
                        />
                        {{ option.label }}
                    </label>
                }
            </fieldset>
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [defaultActivePosition]="{ rowIndex: 0, columnIndex: 0 }"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="People" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div
                                    [dataGridHeaderCell]="cell"
                                    [exampleCellNavigation]="mode()"
                                    [class]="styles.headerCell"
                                >
                                    <ng-container *dataGridCellContent />
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
                                        [exampleCellNavigation]="mode()"
                                        [class]="styles.cell"
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
export default class CustomNavigation {
    protected readonly styles = styles;
    protected readonly modes = MODES;

    readonly rows = rows;
    readonly columns = columns;
    readonly rowKey = (row: Person) => row.id;

    protected readonly mode = signal<Mode>("change-row");
}
