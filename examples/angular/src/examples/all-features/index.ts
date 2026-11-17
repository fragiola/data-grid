import {
    ChangeDetectionStrategy,
    Component,
    signal,
    type TemplateRef,
    ViewChild,
} from "@angular/core";
import { repeatedFill } from "@fragiola/data-grid/fill";
import {
    type CellEditEvent,
    type Column,
    contextOf,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type EditCellRenderProps,
    type HeaderCellInfo,
    type RangeFill,
    type RangePaste,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import { LucideArrowDown, LucideArrowUp } from "@lucide/angular";
import { Input, Numeric } from "#/components/atoms/fields";
import {
    type BudgetedTask,
    budgetedTasks,
    withField,
} from "../_kit/budgeted-tasks";
import { formatMoney } from "../_kit/data";
import { AmountEditor } from "../editing/amount-editor";
import { DateEditor } from "../editing/date-editor";
import { StatusEditor } from "../editing/status-editor";
import { TextEditor } from "../editing/text-editor";
import * as styles from "./styles";

// Everything a sheet does, together: cells edited in place, ranges selected, copied as TSV and
// pasted, filled from a handle, rows sorted, the first column pinned and the others resized. The
// grid owns the keys, the pointer and the clipboard; every value is written by the app, through
// one rule (`withField`), whether typed, pasted or filled. The editors are the editing example's.

/** A change the app writes: a shown row, a column, the value typed, pasted or filled. */
interface Change {
    readonly rowIndex: number;
    readonly columnKey: string;
    readonly value: unknown;
}

type Edit = EditCellRenderProps<BudgetedTask, DataGridNode>;

type EditTemplate = TemplateRef<TemplateContext<Edit>>;

@Component({
    selector: "example-all-features",
    imports: [
        DATA_GRID,
        DataGridLocalRows,
        LucideArrowUp,
        LucideArrowDown,
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
                    <kbd [class]="styles.key">Enter</kbd> edits,
                    <kbd [class]="styles.key">Shift</kbd> + arrows select,
                    <kbd [class]="styles.key">Ctrl/⌘</kbd>
                    <kbd [class]="styles.key">C</kbd>
                    <kbd [class]="styles.key">V</kbd> copy and paste, the corner's
                    square fills
                </span>
                <!-- the app's live region: a polite status, its text the app's own -->
                <span role="status" [class]="styles.status">{{ announcement() }}</span>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [dataGridLocalRows]="local"
                [gridRef]="gridRef"
                [columns]="columns"
                [rowKey]="rowKey"
                [rowHeight]="38"
                cellSelection="range"
                (cellEdit)="edited($event)"
                (rangePaste)="pasted($event)"
                fillable
                (fill)="filled($event)"
                [class]="styles.root"
            >
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
                                <div
                                    [dataGridHeaderCell]="cell"
                                    #header="dataGridHeaderCell"
                                    [class]="styles.headerCell(cell)"
                                >
                                    <ng-container *dataGridCellContent />
                                    @switch (header.state()?.sortDirection) {
                                        @case ("ascending") {
                                            <svg lucideArrowUp aria-hidden="true" [class]="styles.sortIcon"></svg>
                                        }
                                        @case ("descending") {
                                            <svg lucideArrowDown aria-hidden="true" [class]="styles.sortIcon"></svg>
                                        }
                                    }
                                    <!-- its props make it a separator, a focusable one (the APG's splitter), which an <hr> cannot be -->
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
                                    <!-- its own content (the value, or its editor while edited),
                                         then, at the range's corner, the fill handle -->
                                    <div [dataGridCell]="cell" [class]="styles.cell(cell)">
                                        <ng-container *dataGridCellContent />
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
export default class AllFeatures {
    protected readonly styles = styles;
    protected readonly editContext = contextOf<Edit>();
    @ViewChild("textEditor", { static: true })
    private readonly textEditor!: EditTemplate;
    @ViewChild("amountEditor", { static: true })
    private readonly amountEditor!: EditTemplate;
    @ViewChild("statusEditor", { static: true })
    private readonly statusEditor!: EditTemplate;
    @ViewChild("dateEditor", { static: true })
    private readonly dateEditor!: EditTemplate;

    readonly columns: Column<BudgetedTask, DataGridNode>[] = [
        {
            key: "name",
            name: "Task",
            width: 220,
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
            key: "budget",
            name: "Budget",
            width: 120,
            sortable: true,
            resizable: true,
            editable: (task) => task.status !== "Completed",
            renderCell: ({ row }) => formatMoney(row.budget),
            renderEditCell: (edit) => templateContent(this.amountEditor, edit),
        },
        {
            key: "status",
            name: "Status",
            width: 150,
            sortable: true,
            resizable: true,
            editable: true,
            renderEditCell: (edit) => templateContent(this.statusEditor, edit),
        },
        {
            key: "due",
            name: "Due",
            width: 140,
            sortable: true,
            resizable: true,
            editable: true,
            renderEditCell: (edit) => templateContent(this.dateEditor, edit),
        },
        {
            key: "assignee",
            name: "Assignee",
            width: 120,
            sortable: true,
            resizable: true,
        },
    ];

    // the app's rows: the grid never writes them
    private readonly tasks = signal<readonly BudgetedTask[]>(
        budgetedTasks(300),
    );
    readonly announcement = signal("");
    // sorted in memory: the grid's indexes are the rows shown
    // sorting is a feature the grid installs: the local rows' sort needs it, or no column sorts
    readonly features = [sorting()];
    readonly local = injectLocalRows(this.tasks, this.columns);
    // the grid's model from outside its root: a fill repeats the values it reads
    readonly gridRef = createDataGridRef<BudgetedTask>();

    readonly rowKey = (task: BudgetedTask) => task.id;

    protected resizeLabel(cell: HeaderCellInfo<BudgetedTask>): string {
        return `Resize ${cell.column?.name ?? cell.key}`;
    }

    /** Writes changes to the shown rows through the app's one rule, and says what it did. */
    private write(changes: readonly Change[], what: string) {
        const byId = new Map<number, BudgetedTask>();
        let refused = 0;
        for (const { rowIndex, columnKey, value } of changes) {
            const shown = this.local.rows[rowIndex];
            if (!shown) continue;
            const next = withField(
                byId.get(shown.id) ?? shown,
                columnKey,
                value,
            );
            if (next) byId.set(shown.id, next);
            else refused += 1;
        }
        this.tasks.update((current) =>
            current.map((task) => byId.get(task.id) ?? task),
        );
        const written = changes.length - refused;
        this.announcement.set(
            `${what}: ${written} ${written === 1 ? "cell" : "cells"} written${
                refused > 0 ? `, ${refused} refused` : ""
            }.`,
        );
    }

    protected edited(edit: CellEditEvent<BudgetedTask>) {
        this.write([edit], `Saved ${this.columns[edit.columnIndex]?.name}`);
    }

    protected pasted({ range, values }: RangePaste) {
        this.write(
            values.flatMap((texts, row) =>
                texts.map((value, column) => ({
                    rowIndex: range.anchor.rowIndex + row,
                    columnKey:
                        this.columns[range.anchor.columnIndex + column]?.key ??
                        "",
                    value,
                })),
            ),
            "Pasted",
        );
    }

    protected filled(fill: RangeFill) {
        this.write(
            repeatedFill(fill, (at) =>
                this.gridRef.current?.model.get("cell-value-by", at),
            ).map((cell) => ({
                rowIndex: cell.rowIndex,
                columnKey: this.columns[cell.columnIndex]?.key ?? "",
                value: cell.value,
            })),
            "Filled",
        );
    }
}
