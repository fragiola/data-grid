import {
    ChangeDetectionStrategy,
    Component,
    computed,
    signal,
} from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
    type RowMove,
} from "@fragiola/data-grid-angular";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import {
    LucideArrowDown,
    LucideArrowUp,
    LucideGripVertical,
    LucideRotateCcw,
    LucideSearch,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { FIELDS } from "#/components/atoms/fields";
import { type Task, tasks } from "../_kit/tasks";
import * as styles from "./styles";

const backlog = tasks(200);

// "#" is the task's place in the backlog: the app's own order, which a drag or the keys change
const columns: Column<Task, DataGridNode>[] = [
    { key: "rank", name: "#", width: 84, pinned: "start" },
    { key: "name", name: "Task", width: 220, sortable: true },
    { key: "project", name: "Project", width: 130, sortable: true },
    { key: "priority", name: "Priority", width: 110 },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assignee", width: 120 },
    { key: "due", name: "Due", width: 120, sortable: true },
];

/** What the live region says of a move: the app's words, from its own rows. */
function describeMove(rows: readonly Task[], move: RowMove): string {
    const task = rows[move.fromIndex];
    return task
        ? `Moved ${task.name} to position ${move.toIndex + 1} of ${rows.length}.`
        : "";
}

// The rows move by drag and keys while `reorderableRows` is on the root; `(rowMove)` tells each
// move, and the app moves its own rows. A row's handle is the app's element in the rank's cell:
// `[dataGridRowDragHandle]` marks it for the grid and hides it from screen readers, which move
// rows with the keys.

@Component({
    selector: "example-row-reordering",
    imports: [
        DATA_GRID,
        DataGridLocalRows,
        ClickableButton,
        FIELDS,
        LucideArrowDown,
        LucideArrowUp,
        LucideGripVertical,
        LucideRotateCcw,
        LucideSearch,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <kit-input-simple
                    ariaLabel="Search every column"
                    placeholder="Search"
                    [value]="local.filter.search"
                    (valueChange)="local.filter.setSearch($event)"
                    [class]="styles.search"
                >
                    <svg kitInset="start" lucideSearch aria-hidden="true" [class]="styles.icon"></svg>
                </kit-input-simple>
                <span>
                    Drag a handle, or <kbd [class]="styles.key">Ctrl/⌘</kbd
                    ><kbd [class]="styles.key">Shift</kbd
                    ><kbd [class]="styles.key">↑</kbd
                    ><kbd [class]="styles.key">↓</kbd> on a row
                </span>
                <!-- the app's live region: a polite status, its text the app's own -->
                <span role="status" [class]="styles.status">{{
                    sorted() ? "Sorted rows keep the sort's order: clear it to reorder." : announcement()
                }}</span>
                @if (sorted()) {
                    <button kitClickable size="sm" variant="outline" (click)="local.sort.clear()">
                        Clear sort
                    </button>
                }
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    [disabled]="rows() === backlog"
                    (click)="resetOrder()"
                >
                    <svg lucideRotateCcw aria-hidden="true"></svg>
                    Reset order
                </button>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [dataGridLocalRows]="local"
                [columns]="columns"
                [rowKey]="rowKey"
                [rowHeight]="38"
                reorderableRows
                (rowMove)="onRowMove($event)"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="Backlog" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div
                                    [dataGridHeaderCell]="cell"
                                    #header="dataGridHeaderCell"
                                    [class]="styles.headerCell"
                                >
                                    <!-- its content (the column's name), then the sort's arrow -->
                                    <ng-container *dataGridCellContent />
                                    @switch (header.state()?.sortDirection) {
                                        @case ("ascending") {
                                            <svg lucideArrowUp aria-hidden="true" [class]="styles.sortIcon"></svg>
                                        }
                                        @case ("descending") {
                                            <svg lucideArrowDown aria-hidden="true" [class]="styles.sortIcon"></svg>
                                        }
                                    }
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    @if (cell.column.key === "rank") {
                                        <!-- the rank's cell: the handle, then the task's place -->
                                        <div [dataGridCell]="cell" [class]="styles.cell(cell)">
                                            <span
                                                [dataGridRowDragHandle]="cell"
                                                #handle="dataGridRowDragHandle"
                                                [class]="styles.handle(handle.state())"
                                            >
                                                <svg lucideGripVertical aria-hidden="true" [class]="styles.grip"></svg>
                                            </span>
                                            <span [class]="styles.rank">{{
                                                cell.row && ranks().get(cell.row.id)
                                            }}</span>
                                        </div>
                                    } @else {
                                        <div [dataGridCell]="cell" [class]="styles.cell(cell)">
                                            <ng-container *dataGridCellContent />
                                        </div>
                                    }
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class RowReordering {
    protected readonly styles = styles;

    readonly backlog = backlog;
    readonly columns = columns;
    readonly rowKey = (row: Task) => row.id;

    // the app's rows, in its own order: the grid never orders them, it tells each move
    readonly rows = signal<readonly Task[]>(backlog);
    readonly announcement = signal("");
    // searched and sorted in memory; a move lands beside the row it was dropped on, searched too
    // the features the grid installs: sorting (the local rows' sort needs it, or no column sorts),
    // cell navigation (the keys, the active cell, the tab stop)
    readonly features = [sorting(), navigation()];
    readonly local = injectLocalRows(this.rows, columns);
    protected readonly sorted = computed(
        () => this.local.sort.columns.length > 0,
    );
    // each task's place in the backlog, searched or sorted alike
    protected readonly ranks = computed(
        () => new Map(this.rows().map((task, index) => [task.id, index + 1])),
    );

    protected resetOrder(): void {
        this.rows.set(backlog);
        this.announcement.set("Backlog back in its first order.");
    }

    protected onRowMove(move: RowMove): void {
        this.announcement.set(describeMove(this.local.rows, move));
        this.rows.set(this.local.moveRow(move));
    }
}
