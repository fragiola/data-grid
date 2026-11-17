import {
    ChangeDetectionStrategy,
    Component,
    signal,
    type TemplateRef,
    ViewChild,
} from "@angular/core";
import {
    type CellEditEvent,
    type CellTemplateProps,
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridNode,
    type EditCellRenderProps,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import { Input, Numeric } from "#/components/atoms/fields";
import {
    budgetedTasks,
    type BudgetedTask as Row,
    withField,
} from "../_kit/budgeted-tasks";
import { formatMoney } from "../_kit/data";
import { AmountEditor } from "./amount-editor";
import { DateEditor } from "./date-editor";
import { StatusEditor } from "./status-editor";
import * as styles from "./styles";
import { TextEditor } from "./text-editor";

// Tasks edited in place: the grid edits a cell (the keys, the draft, the commit), the editors are
// the app's (a text field, a number, a select, a date: the `*-editor.ts` files, each given the
// edit, its draft and the ways to change, commit and cancel it, its look by its caller's `class`)
// and so is the data: each commit is told, and the app writes it into its rows. A column's
// `renderEditCell` hands its editor's template the edit (`templateContent`).

const initialRows = budgetedTasks(120);

type Edit = EditCellRenderProps<Row, DataGridNode>;

type EditTemplate = TemplateRef<TemplateContext<Edit>>;

@Component({
    selector: "example-editing",
    imports: [
        DATA_GRID,
        Input,
        Numeric,
        TextEditor,
        AmountEditor,
        StatusEditor,
        DateEditor,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span>
                    <kbd [class]="styles.key">Enter</kbd>
                    <kbd [class]="styles.key">F2</kbd> or typing edit;
                    <kbd [class]="styles.key">Enter</kbd>
                    <kbd [class]="styles.key">Tab</kbd> save,
                    <kbd [class]="styles.key">Esc</kbd> cancels
                </span>
                <!-- the app's live region: a polite status, its text the app's own -->
                <span role="status" [class]="styles.status">{{ announcement() }}</span>
            </div>
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows()"
                [rowKey]="rowKey"
                [rowHeight]="38"
                (cellEdit)="onCellEdit($event)"
                [class]="styles.root"
            >
                <ng-template #budgetCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.budget(row.status)">{{ money(row.budget) }}</span>
                </ng-template>
                <ng-template #textEditor [dataGridTemplate]="editContext" let-edit>
                    <input kitInput exampleTextEditor [edit]="edit" [class]="styles.editor" />
                </ng-template>
                <ng-template #amountEditor [dataGridTemplate]="editContext" let-edit>
                    <input
                        kitNumeric
                        exampleAmountEditor
                        [edit]="edit"
                        [min]="0"
                        [step]="100"
                        [class]="styles.editor"
                    />
                </ng-template>
                <ng-template #statusEditor [dataGridTemplate]="editContext" let-edit>
                    <example-status-editor [edit]="edit" [class]="styles.select" />
                </ng-template>
                <ng-template #dateEditor [dataGridTemplate]="editContext" let-edit>
                    <input kitInput type="date" exampleDateEditor [edit]="edit" [class]="styles.editor" />
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
export default class Editing {
    protected readonly styles = styles;
    protected readonly cellContext = contextOf<CellTemplateProps<Row>>();
    protected readonly editContext = contextOf<Edit>();
    @ViewChild("budgetCell", { static: true })
    private readonly budgetCell!: TemplateRef<
        TemplateContext<CellTemplateProps<Row>>
    >;
    @ViewChild("textEditor", { static: true })
    private readonly textEditor!: EditTemplate;
    @ViewChild("amountEditor", { static: true })
    private readonly amountEditor!: EditTemplate;
    @ViewChild("statusEditor", { static: true })
    private readonly statusEditor!: EditTemplate;
    @ViewChild("dateEditor", { static: true })
    private readonly dateEditor!: EditTemplate;

    readonly columns: Column<Row, DataGridNode>[] = [
        {
            key: "name",
            name: "Task",
            width: 220,
            editable: true,
            renderEditCell: (edit) => templateContent(this.textEditor, edit),
        },
        { key: "project", name: "Project", width: 120 },
        {
            key: "budget",
            name: "Budget",
            width: 120,
            // a completed task's budget is closed
            editable: (row) => row.status !== "Completed",
            renderCell: (props) => templateContent(this.budgetCell, props),
            renderEditCell: (edit) => templateContent(this.amountEditor, edit),
        },
        {
            key: "status",
            name: "Status",
            width: 160,
            editable: true,
            renderEditCell: (edit) => templateContent(this.statusEditor, edit),
        },
        {
            key: "due",
            name: "Due",
            width: 150,
            editable: true,
            renderEditCell: (edit) => templateContent(this.dateEditor, edit),
        },
        { key: "assignee", name: "Assignee", width: 120 },
    ];

    // the app's rows: the grid never writes them, a commit is told
    readonly rows = signal<readonly Row[]>(initialRows);
    readonly announcement = signal("");

    readonly rowKey = (row: Row) => row.id;

    protected money(value: number): string {
        return formatMoney(value);
    }

    protected onCellEdit(edit: CellEditEvent<Row>) {
        const next = withField(edit.row, edit.columnKey, edit.value);
        const column = this.columns[edit.columnIndex];
        if (!next) {
            this.announcement.set(
                `${column?.name} of ${edit.row.name} was not saved: not a valid value.`,
            );
            return;
        }
        this.rows.update((current) =>
            current.map((row) => (row.id === next.id ? next : row)),
        );
        this.announcement.set(`Saved ${column?.name} of ${next.name}.`);
    }
}
