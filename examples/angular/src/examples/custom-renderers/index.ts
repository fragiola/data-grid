import {
    ChangeDetectionStrategy,
    Component,
    signal,
    type TemplateRef,
    ViewChild,
} from "@angular/core";
import {
    type CellEditEvent,
    type CellInfo,
    type CellTemplateProps,
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridNode,
    type EditCellRenderProps,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { Input } from "#/components/atoms/fields";
import { type Task, tasks } from "../_kit/tasks";
import { SortStatus } from "./header-cell";
import { SelectAll } from "./select-all";
import { SelectRow } from "./select-row";
import * as styles from "./styles";
import { TextEditor } from "./text-editor";

// React Data Grid has a renderer for each piece (`renderCheckbox`, `renderSortStatus`,
// `renderCell`, `renderRow`). Here there is nothing else: the checkbox, the sort indicator, a
// cell's and a row's look are the app's markup and classes, from the parts' state and the row.

const ROWS = tasks(500);
const IDS = ROWS.map((task) => task.id);

/** A row styled from its data: a completed task. */
const completed = (task: Task | undefined) => task?.status === "Completed";

/** A cell styled from its value: a high priority. */
const highPriority = (cell: CellInfo<Task>) =>
    cell.column.key === "priority" && cell.value === "High";

type EditProps = EditCellRenderProps<Task, DataGridNode>;

@Component({
    selector: "example-custom-renderers",
    imports: [
        DATA_GRID,
        DataGridLocalRows,
        Input,
        SelectAll,
        SelectRow,
        SortStatus,
        TextEditor,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div
                dataGridRoot
                [dataGridLocalRows]="local"
                [columns]="columns"
                [rowKey]="rowKey"
                [rowHeight]="36"
                rowSelection="multiple"
                (cellEdit)="onCellEdit($event)"
                [class]="styles.root"
            >
                <ng-template #selectAll [dataGridTemplate]="headerContext">
                    <example-select-all [rowKeys]="IDS" />
                </ng-template>
                <ng-template #selectRow [dataGridTemplate]="cellContext" let-row="row" let-rowIndex="rowIndex">
                    <example-select-row [rowIndex]="rowIndex" [name]="row.name" />
                </ng-template>
                <ng-template #titleEditor [dataGridTemplate]="editContext" let-edit>
                    <input kitInput exampleTextEditor [edit]="edit" [class]="styles.editor" />
                </ng-template>
                <div dataGridGrid aria-label="Tasks" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div
                                    [dataGridHeaderCell]="cell"
                                    exampleSortStatus
                                    [class]="styles.headerCell(cell)"
                                ></div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <!-- a row styled from its data: a completed task is tinted -->
                            <div [dataGridRow]="row" [class]="styles.row(row, completed(row.row))">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <!-- a cell styled from its value: a high priority stands out -->
                                    <div [dataGridCell]="cell" [class]="styles.cell(cell, highPriority(cell))">
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
export default class CustomRenderers {
    protected readonly styles = styles;
    protected readonly IDS = IDS;
    protected readonly completed = completed;
    protected readonly highPriority = highPriority;
    protected readonly headerContext = contextOf<object>();
    protected readonly cellContext = contextOf<CellTemplateProps<Task>>();
    protected readonly editContext = contextOf<EditProps>();

    @ViewChild("selectAll", { static: true })
    private readonly selectAll!: TemplateRef<TemplateContext<object>>;
    @ViewChild("selectRow", { static: true })
    private readonly selectRow!: TemplateRef<
        TemplateContext<CellTemplateProps<Task>>
    >;
    @ViewChild("titleEditor", { static: true })
    private readonly titleEditor!: TemplateRef<TemplateContext<EditProps>>;

    readonly columns: Column<Task, DataGridNode>[] = [
        {
            key: "select",
            width: 44,
            renderHeaderCell: () => templateContent(this.selectAll, {}),
            renderCell: (props) => templateContent(this.selectRow, props),
        },
        { key: "id", name: "#", width: 64, sortable: true },
        {
            key: "name",
            name: "Title",
            width: 220,
            sortable: true,
            editable: true,
            renderEditCell: (edit) => templateContent(this.titleEditor, edit),
        },
        { key: "priority", name: "Priority", width: 110, sortable: true },
        { key: "status", name: "Status", width: 130, sortable: true },
        { key: "assignee", name: "Assignee", width: 110, sortable: true },
        { key: "due", name: "Due", width: 120, sortable: true },
    ];

    private readonly rows = signal<readonly Task[]>(ROWS);
    readonly local = injectLocalRows(this.rows, this.columns);

    readonly rowKey = (row: Task) => row.id;

    protected onCellEdit({ row, value }: CellEditEvent<Task>) {
        // the app writes the title: the grid never writes a row
        this.rows.update((current) =>
            current.map((task) =>
                task.id === row.id && typeof value === "string"
                    ? { ...task, name: value.trim() || task.name }
                    : task,
            ),
        );
    }
}
