import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { filtering } from "@fragiola/data-grid-angular/filtering";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import { ClickableButton } from "#/components/atoms/clickable";
import { SWITCH } from "#/components/ui/switch";
import { type Task, tasks } from "../_kit/tasks";
import { Filter } from "./filter";
import { FilterHeader } from "./header-cell";
import * as styles from "./styles";

const ROWS = tasks(1_000);

const columns: Column<Task, DataGridNode>[] = [
    { key: "id", name: "#", width: 64, sortable: true },
    { key: "name", name: "Task", width: 220, sortable: true },
    { key: "project", name: "Project", width: 130, sortable: true },
    { key: "priority", name: "Priority", width: 120, sortable: true },
    { key: "status", name: "Status", width: 140, sortable: true },
    { key: "assignee", name: "Assignee", width: 120, sortable: true },
    {
        key: "effectiveness",
        name: "Rating",
        width: 120,
        sortable: true,
        renderCell: ({ row }) => "★".repeat(row.effectiveness),
        // its own filter: a minimum rating, not an equal one
        filter: (value, minimum) =>
            typeof value === "number" &&
            typeof minimum === "number" &&
            value >= minimum,
    },
];

let ids = 0;

// The filters are controls inside the header cells. The grid keeps a header cell holding
// controls one tab stop: a click on a control (or Enter, F2) hands it the keys, Tab moves among
// a cell's controls and Escape gives them back; a click on a control is never a sort. The rows
// are filtered and sorted in memory by `injectLocalRows`, the filters' values kept by it.

@Component({
    selector: "example-header-filters",
    imports: [
        DATA_GRID,
        DataGridLocalRows,
        ClickableButton,
        SWITCH,
        Filter,
        FilterHeader,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span [class]="styles.toggle">
                    <button kitSwitch [attr.aria-labelledby]="shownLabel" [(checked)]="shown">
                        <span kitSwitchThumb></span>
                    </button>
                    <span [id]="shownLabel">Filters</span>
                </span>
                <button kitClickable size="sm" variant="outline" (click)="local.filter.clear()">
                    Clear filters
                </button>
                <span [class]="styles.count" data-testid="count">
                    {{ local.filteredCount }} of {{ ROWS.length }} tasks
                </span>
            </div>
            <!-- the header row's height: room for the filter under the name -->
            <div
                dataGridRoot
                [features]="features"
                [dataGridLocalRows]="local"
                [columns]="columns"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [headerRowHeight]="shown() ? 72 : 36"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="Tasks" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" exampleFilterHeader [class]="styles.headerCell">
                                    @if (shown()) {
                                        <example-filter
                                            [cell]="cell"
                                            [value]="local.filter.values[cell.key]"
                                            (valueChange)="local.filter.set(cell.key, $event)"
                                        />
                                    }
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div [dataGridCell]="cell" [class]="styles.cell">
                                        <ng-container *dataGridCellContent />
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <div *dataGridEmpty [class]="styles.empty">No task matches these filters.</div>
                </div>
            </div>
        </div>
    `,
})
export default class HeaderFilters {
    protected readonly styles = styles;
    protected readonly ROWS = ROWS;

    readonly columns = columns;
    // the features the grid installs: sorting (the local rows' sort needs it, or no column sorts),
    // cell navigation (the keys, the active cell, the tab stop)
    // and filtering (the column filters): `injectLocalRows` applies them to the rows, the
    // grid's model holds them
    readonly features = [sorting(), filtering(), navigation()];
    readonly local = injectLocalRows(ROWS, columns, {
        features: this.features,
    });
    readonly shown = signal(true);
    readonly shownLabel = `header-filters-shown-${++ids}`;

    readonly rowKey = (row: Task) => row.id;
}
