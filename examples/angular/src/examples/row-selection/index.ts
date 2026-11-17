import {
    ChangeDetectionStrategy,
    Component,
    signal,
    type TemplateRef,
    ViewChild,
} from "@angular/core";
import {
    type CellTemplateProps,
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridNode,
    type RowInfo,
    type RowKey,
    type RowSelection,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import { SWITCH } from "#/components/ui/switch";
import { type Task, tasks } from "../_kit/tasks";
import { SelectAll } from "./select-all";
import { SelectRow } from "./select-row";
import * as styles from "./styles";

// The grid selects the rows (a checkbox, Shift+click, Shift+Space, Shift+↓, Ctrl+A) and tells the
// app their keys; the select column's renderers are the templates at the top of the root, its
// checkboxes components (`select-row.ts`, `select-all.ts`).

const ROWS = tasks(200);

/** A completed task cannot be selected: the grid skips it in a range and in "select all". */
const isSelectable = (task: Task) => task.status !== "Completed";

/** The rows "select all" covers: the ones that can be selected. */
const SELECTABLE_IDS = ROWS.filter(isSelectable).map((task) => task.id);

let ids = 0;

@Component({
    selector: "example-row-selection",
    imports: [DATA_GRID, SWITCH, SelectAll, SelectRow],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span [class]="styles.mode">
                    <button
                        kitSwitch
                        [attr.aria-labelledby]="modeLabel"
                        [checked]="mode() === 'single'"
                        (checkedChange)="mode.set($event ? 'single' : 'multiple')"
                    >
                        <span kitSwitchThumb></span>
                    </button>
                    <span [id]="modeLabel">One at a time</span>
                </span>
                <span>
                    <kbd [class]="styles.key">Shift</kbd>+<kbd [class]="styles.key">Space</kbd>
                    a row
                </span>
                @if (mode() === "multiple") {
                    <span>
                        <kbd [class]="styles.key">Shift</kbd>+<kbd [class]="styles.key">↓</kbd>
                        extend
                    </span>
                    <span>
                        <kbd [class]="styles.key">Ctrl</kbd>+<kbd [class]="styles.key">A</kbd>
                        every row
                    </span>
                }
                <span [class]="styles.count" data-testid="selected-count">
                    {{ selected().length }} selected
                </span>
            </div>
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="40"
                [rowSelection]="mode()"
                [isRowSelectable]="isSelectable"
                [(selectedRowKeys)]="selected"
                [class]="styles.root"
            >
                <!-- the select column's renderers: inside the root, where the grid is injected -->
                <ng-template #selectAll [dataGridTemplate]="headerContext">
                    <example-select-all [rowKeys]="selectableIds" />
                </ng-template>
                <ng-template
                    #selectRow
                    [dataGridTemplate]="cellContext"
                    let-row="row"
                    let-rowIndex="rowIndex"
                >
                    <example-select-row [rowIndex]="rowIndex" [name]="row.name" />
                </ng-template>
                <div dataGridGrid aria-label="Tasks" [class]="styles.grid">
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
                            <div [dataGridRow]="row" [class]="styles.row(row, locked(row))">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div [dataGridCell]="cell" [class]="styles.cell">
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
export default class RowSelectionExample {
    protected readonly styles = styles;

    readonly rows = ROWS;
    readonly selectableIds = SELECTABLE_IDS;
    readonly isSelectable = isSelectable;

    readonly mode = signal<RowSelection>("multiple");
    // the grid selects; the app keeps the keys (here, to count them)
    readonly selected = signal<readonly RowKey[]>([]);
    readonly modeLabel = `row-selection-mode-${++ids}`;

    readonly headerContext = contextOf<object>();
    readonly cellContext = contextOf<CellTemplateProps<Task>>();
    @ViewChild("selectAll", { static: true })
    private readonly selectAll!: TemplateRef<TemplateContext<object>>;
    @ViewChild("selectRow", { static: true })
    private readonly selectRow!: TemplateRef<
        TemplateContext<CellTemplateProps<Task>>
    >;

    readonly columns: Column<Task, DataGridNode>[] = [
        {
            key: "select",
            width: 48,
            renderHeaderCell: () => templateContent(this.selectAll, {}),
            renderCell: (props) => templateContent(this.selectRow, props),
        },
        { key: "name", name: "Task", width: 240 },
        { key: "status", name: "Status", width: 130 },
        { key: "assignee", name: "Assignee", width: 110 },
        { key: "priority", name: "Priority", width: 100 },
        { key: "due", name: "Due", width: 120 },
    ];

    readonly rowKey = (row: Task) => row.id;

    /** A completed task, which cannot be selected: its row is faded. */
    locked(row: RowInfo<Task>) {
        return row.row !== undefined && !isSelectable(row.row);
    }
}
