import {
    ChangeDetectionStrategy,
    Component,
    computed,
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
    type RowKey,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import { LucideDownload } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { Input, Numeric } from "#/components/atoms/fields";
import { CHECKBOX } from "#/components/ui/checkbox";
import {
    type BudgetedTask,
    budgetedTasks,
    withField,
} from "../_kit/budgeted-tasks";
import { formatMoney, hash } from "../_kit/data";
import { AmountEditor } from "../editing/amount-editor";
import { DateEditor } from "../editing/date-editor";
import { StatusEditor } from "../editing/status-editor";
import { TextEditor } from "../editing/text-editor";
import { HeaderCell } from "./header-cell";
import { SelectAll } from "./select-all";
import { SelectRow } from "./select-row";
import * as styles from "./styles";
import type { Totals } from "./summaries";
import { Summary } from "./summary";

// React Data Grid's "common features" in one grid: a selection column, columns pinned at the
// start and at the end, every column sortable and resizable, cells edited in place, a summary
// row on top and one at the bottom, and an export. The grid keeps the state that is its own
// (selection, sort, widths); the rows, the edits, the totals and the export are the app's.

interface Job extends BudgetedTask {
    /** whether the assignee can take it now: a checkbox the app writes */
    available: boolean;
}

type Edit = EditCellRenderProps<Job, DataGridNode>;
type JobCell = TemplateRef<TemplateContext<CellTemplateProps<Job>>>;
type JobEdit = TemplateRef<TemplateContext<Edit>>;

const JOBS: Job[] = budgetedTasks(1_000).map((task) => ({
    ...task,
    available: hash(task.id + 101, 3) > 0,
}));

/** A completed job cannot be selected: the grid skips it in a range and in "select all". */
const isSelectable = (job: Job) => job.status !== "Completed";

const SUMMARY_ROWS = { top: 1, bottom: 1 };

/** A column's text in the CSV: its value, quoted when it holds a comma, a quote or a line break. */
function csvField(value: unknown): string {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A column's text in the export, where it is not the value itself: what the grid shows. */
const EXPORT_TEXT: Partial<Record<string, (job: Job) => string>> = {
    effectiveness: (job) => `${job.effectiveness * 20}%`,
    budget: (job) => formatMoney(job.budget),
    available: (job) => (job.available ? "Yes" : "No"),
};

/**
 * The rows as CSV, in the order shown, with every column but the checkboxes', each cell as the
 * grid shows it. The app has every row: it exports them, not the few the grid renders.
 */
function toCsv(
    columns: readonly Column<Job, DataGridNode>[],
    rows: readonly Job[],
): string {
    const exported = columns.filter((column) => column.key !== "select");
    return [
        exported.map((column) => csvField(column.name)).join(","),
        ...rows.map((row) => {
            // the row's fields by key
            const fields: Record<string, unknown> = { ...row };
            return exported
                .map((column) =>
                    csvField(
                        EXPORT_TEXT[column.key]?.(row) ?? fields[column.key],
                    ),
                )
                .join(",");
        }),
    ].join("\n");
}

/** Hands the reader a file (the browser's download), from text the app made. */
function download(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    // released once the browser has taken the file: at once, it could cancel the download
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

@Component({
    selector: "example-common-features",
    imports: [
        DATA_GRID,
        DataGridLocalRows,
        ClickableButton,
        CHECKBOX,
        Input,
        Numeric,
        LucideDownload,
        TextEditor,
        AmountEditor,
        StatusEditor,
        DateEditor,
        HeaderCell,
        SelectAll,
        SelectRow,
        Summary,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span data-testid="selected-count">{{ selected().length }} selected</span>
                <button kitClickable size="sm" variant="outline" (click)="exportCsv()">
                    <svg lucideDownload aria-hidden="true"></svg>
                    Export to CSV
                </button>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [dataGridLocalRows]="local"
                [columns]="columns"
                [rowKey]="rowKey"
                [rowHeight]="38"
                rowSelection="multiple"
                [isRowSelectable]="isSelectable"
                (selectedRowKeysChange)="selected.set($event)"
                [summaryRows]="SUMMARY_ROWS"
                [summaryRowHeight]="38"
                (cellEdit)="edited($event)"
                [class]="styles.root"
            >
                <!-- "select all" covers the rows that can be selected, worked out again as the jobs change -->
                <ng-template #selectAll [dataGridTemplate]="headerContext">
                    <example-select-all [rowKeys]="selectableIds()" />
                </ng-template>
                <ng-template #selectRow [dataGridTemplate]="cellContext" let-row="row" let-rowIndex="rowIndex">
                    <example-select-row [rowIndex]="rowIndex" [name]="row.name" />
                </ng-template>
                <ng-template #progress [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.progress">
                        <progress
                            max="5"
                            [value]="row.effectiveness"
                            [attr.aria-label]="row.name + ' completion'"
                            [class]="styles.bar"
                        ></progress>
                        {{ row.effectiveness * 20 }}%
                    </span>
                </ng-template>
                <ng-template #available [dataGridTemplate]="cellContext" let-row="row">
                    <button
                        kitCheckbox
                        [attr.aria-label]="row.name + ' available'"
                        [checked]="row.available"
                        (checkedChange)="setAvailable(row.id, $event.checked)"
                    >
                        <span kitCheckboxIndicator></span>
                    </button>
                </ng-template>
                <ng-template #textEditor [dataGridTemplate]="editContext" let-edit>
                    <input kitInput exampleTextEditor [edit]="edit" [class]="styles.editor" />
                </ng-template>
                <ng-template #statusEditor [dataGridTemplate]="editContext" let-edit>
                    <example-status-editor [edit]="edit" [class]="styles.select" />
                </ng-template>
                <ng-template #dateEditor [dataGridTemplate]="editContext" let-edit>
                    <input kitInput type="date" exampleDateEditor [edit]="edit" [class]="styles.editor" />
                </ng-template>
                <ng-template #amountEditor [dataGridTemplate]="editContext" let-edit>
                    <input kitNumeric exampleAmountEditor [edit]="edit" [min]="0" [step]="100" [class]="styles.editor" />
                </ng-template>
                <div dataGridGrid aria-label="Jobs" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" exampleHeaderCell></div>
                            </ng-template>
                        </div>
                    </div>
                    <div
                        *dataGridSummary="'top'"
                        exampleSummary
                        [columns]="columns"
                        [totals]="totals()"
                        [class]="styles.summary"
                    ></div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div
                                        [dataGridCell]="cell"
                                        #part="dataGridCell"
                                        [class]="styles.cell(part.state())"
                                    >
                                        <ng-container *dataGridCellContent />
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <!-- after the body: it stays at the view's bottom edge -->
                    <div
                        *dataGridSummary="'bottom'"
                        exampleSummary
                        [columns]="columns"
                        [totals]="totals()"
                        [class]="styles.summary"
                    ></div>
                </div>
            </div>
        </div>
    `,
})
export default class CommonFeatures {
    protected readonly styles = styles;
    protected readonly SUMMARY_ROWS = SUMMARY_ROWS;
    protected readonly isSelectable = isSelectable;
    protected readonly headerContext = contextOf<object>();
    protected readonly cellContext = contextOf<CellTemplateProps<Job>>();
    protected readonly editContext = contextOf<Edit>();

    // read once: the templates never change (a query read again as each cell renders costs its
    // views' walk every time)
    @ViewChild("selectAll", { static: true })
    private readonly selectAll!: TemplateRef<TemplateContext<object>>;
    @ViewChild("selectRow", { static: true })
    private readonly selectRow!: JobCell;
    @ViewChild("progress", { static: true })
    private readonly progress!: JobCell;
    @ViewChild("available", { static: true })
    private readonly available!: JobCell;
    @ViewChild("textEditor", { static: true })
    private readonly textEditor!: JobEdit;
    @ViewChild("statusEditor", { static: true })
    private readonly statusEditor!: JobEdit;
    @ViewChild("dateEditor", { static: true })
    private readonly dateEditor!: JobEdit;
    @ViewChild("amountEditor", { static: true })
    private readonly amountEditor!: JobEdit;

    readonly jobs = signal<readonly Job[]>(JOBS);

    // made once: the renderers read the app's rows when they run
    readonly columns: Column<Job, DataGridNode>[] = [
        {
            key: "select",
            width: 44,
            pinned: "start",
            renderHeaderCell: (props) => templateContent(this.selectAll, props),
            renderCell: (props) => templateContent(this.selectRow, props),
        },
        {
            key: "name",
            name: "Task",
            width: 200,
            pinned: "start",
            sortable: true,
            resizable: true,
            editable: true,
            renderEditCell: (edit) => templateContent(this.textEditor, edit),
        },
        {
            key: "project",
            name: "Project",
            width: 120,
            sortable: true,
            resizable: true,
        },
        {
            key: "status",
            name: "Status",
            width: 140,
            sortable: true,
            resizable: true,
            editable: true,
            renderEditCell: (edit) => templateContent(this.statusEditor, edit),
        },
        {
            key: "priority",
            name: "Priority",
            width: 110,
            sortable: true,
            resizable: true,
        },
        {
            key: "assignee",
            name: "Assignee",
            width: 120,
            sortable: true,
            resizable: true,
        },
        {
            key: "effectiveness",
            name: "Completion",
            width: 150,
            sortable: true,
            resizable: true,
            renderCell: (props) => templateContent(this.progress, props),
        },
        {
            key: "due",
            name: "Deadline",
            width: 140,
            sortable: true,
            resizable: true,
            editable: true,
            renderEditCell: (edit) => templateContent(this.dateEditor, edit),
        },
        {
            key: "budget",
            name: "Budget",
            width: 120,
            sortable: true,
            resizable: true,
            editable: (job) => job.status !== "Completed",
            renderCell: ({ row }) => formatMoney(row.budget),
            renderEditCell: (edit) => templateContent(this.amountEditor, edit),
        },
        {
            key: "available",
            name: "Available",
            width: 100,
            pinned: "end",
            sortable: true,
            renderCell: (props) => templateContent(this.available, props),
        },
    ];

    // sorting is a feature the grid installs: the local rows' sort needs it, or no column sorts
    readonly features = [sorting()];
    readonly local = injectLocalRows(this.jobs, this.columns);
    /**
     * The rows "select all" covers: the ones that can be selected, worked out again as the jobs
     * change (an edit can complete one).
     */
    protected readonly selectableIds = computed(() =>
        this.jobs()
            .filter(isSelectable)
            .map((job) => job.id),
    );
    protected readonly totals = computed(
        (): Totals => ({
            count: this.jobs().length,
            budget: this.jobs().reduce((sum, job) => sum + job.budget, 0),
            available: this.jobs().filter((job) => job.available).length,
        }),
    );
    readonly selected = signal<readonly RowKey[]>([]);

    readonly rowKey = (row: Job) => row.id;

    protected setAvailable(id: number, available: boolean) {
        this.jobs.update((current) =>
            current.map((job) => (job.id === id ? { ...job, available } : job)),
        );
    }

    protected exportCsv() {
        download(toCsv(this.columns, this.local.rows), "jobs.csv");
    }

    protected edited({ row, columnKey, value }: CellEditEvent<Job>) {
        // the app writes the value, through its one rule; a refused one changes nothing
        this.jobs.update((current) =>
            current.map((job) => {
                if (job.id !== row.id) return job;
                const next = withField(job, columnKey, value);
                return next ? { ...job, ...next } : job;
            }),
        );
    }
}
