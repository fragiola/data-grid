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
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { LucideCopy, LucideTrash2 } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { CHECKBOX } from "#/components/ui/checkbox";
import { SELECT_PARTS } from "#/components/ui/select";
import { STATUSES, type Task, tasks } from "../_kit/tasks";
import * as styles from "./styles";

const STATUS_ITEMS = Object.fromEntries(
    STATUSES.map((status) => [status, status]),
);

function isStatus(value: unknown): value is Task["status"] {
    return STATUSES.some((status) => status === value);
}

type TaskCell = TemplateRef<TemplateContext<CellTemplateProps<Task>>>;

// Every cell holds controls, and the grid stays one tab stop: it keeps them out of the tab order
// and hands a cell's keys to them on Enter or F2 (or a click); Escape comes back. Each column's
// controls are a template of this component's (its renderer hands it the row), so they act on
// the app's rows directly.

@Component({
    selector: "example-interactive-cells",
    imports: [
        DATA_GRID,
        ClickableButton,
        Input,
        CHECKBOX,
        SELECT_PARTS,
        LucideCopy,
        LucideTrash2,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <p [class]="styles.hint">
                <span><kbd [class]="styles.key">Enter</kbd> or <kbd [class]="styles.key">F2</kbd> into a cell's controls</span>
                <span><kbd [class]="styles.key">Tab</kbd> its next control</span>
                <span><kbd [class]="styles.key">Esc</kbd> back to the grid</span>
                <span [class]="styles.count" data-testid="count">{{ rows().length }} tasks</span>
            </p>
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rows]="rows()"
                [rowKey]="rowKey"
                [rowHeight]="44"
                [class]="styles.root"
            >
                <ng-template #doneCell [dataGridTemplate]="cellContext" let-row="row">
                    <button
                        kitCheckbox
                        [attr.aria-label]="row.name + ' done'"
                        [checked]="row.status === 'Completed'"
                        (checkedChange)="update(row.id, { status: $event.checked ? 'Completed' : 'In Progress' })"
                    >
                        <span kitCheckboxIndicator></span>
                    </button>
                </ng-template>
                <ng-template #nameCell [dataGridTemplate]="cellContext" let-row="row">
                    <input
                        kitInput
                        [attr.aria-label]="'Name of task ' + row.id"
                        [value]="row.name"
                        (input)="rename(row.id, $event)"
                        [class]="styles.field"
                    />
                </ng-template>
                <ng-template #statusCell [dataGridTemplate]="cellContext" let-row="row">
                    <button
                        [kitSelectTrigger]="statusList"
                        [items]="STATUS_ITEMS"
                        [value]="row.status"
                        (valueChange)="setStatus(row.id, $event)"
                        [attr.aria-label]="'Status of ' + row.name"
                        [class]="styles.select"
                    >
                        <span kitSelectValue></span>
                    </button>
                    <ng-template #statusList>
                        <div kitSelectContent>
                            @for (status of STATUSES; track status) {
                                <div [kitSelectItem]="status">{{ status }}</div>
                            }
                        </div>
                    </ng-template>
                </ng-template>
                <ng-template #assigneeCell [dataGridTemplate]="cellContext" let-row="row">
                    <a [class]="styles.link" [href]="'mailto:' + row.assignee.toLowerCase() + '@example.com'">{{ row.assignee }}</a>
                </ng-template>
                <ng-template #actionsCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.actions">
                        <button
                            kitClickable
                            size="sm"
                            variant="ghost"
                            [attr.aria-label]="'Duplicate ' + row.name"
                            (click)="duplicate(row.id)"
                        >
                            <svg lucideCopy aria-hidden="true"></svg>
                        </button>
                        <button
                            kitClickable
                            size="sm"
                            variant="ghost"
                            [attr.aria-label]="'Delete ' + row.name"
                            (click)="remove(row.id)"
                        >
                            <svg lucideTrash2 aria-hidden="true"></svg>
                        </button>
                    </span>
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
export default class InteractiveCells {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;
    protected readonly STATUSES = STATUSES;
    protected readonly STATUS_ITEMS = STATUS_ITEMS;
    protected readonly cellContext = contextOf<CellTemplateProps<Task>>();

    @ViewChild("doneCell", { static: true })
    private readonly doneCell!: TaskCell;
    @ViewChild("nameCell", { static: true })
    private readonly nameCell!: TaskCell;
    @ViewChild("statusCell", { static: true })
    private readonly statusCell!: TaskCell;
    @ViewChild("assigneeCell", { static: true })
    private readonly assigneeCell!: TaskCell;
    @ViewChild("actionsCell", { static: true })
    private readonly actionsCell!: TaskCell;

    readonly columns: Column<Task, DataGridNode>[] = [
        {
            key: "done",
            name: "Done",
            width: 64,
            renderCell: (props) => templateContent(this.doneCell, props),
        },
        {
            key: "name",
            name: "Task",
            width: 240,
            renderCell: (props) => templateContent(this.nameCell, props),
        },
        {
            key: "status",
            name: "Status",
            width: 170,
            renderCell: (props) => templateContent(this.statusCell, props),
        },
        {
            key: "assignee",
            name: "Assignee",
            width: 150,
            renderCell: (props) => templateContent(this.assigneeCell, props),
        },
        {
            key: "actions",
            name: "Actions",
            width: 110,
            renderCell: (props) => templateContent(this.actionsCell, props),
        },
    ];

    readonly rows = signal<readonly Task[]>(tasks(60));

    readonly rowKey = (row: Task) => row.id;

    /** What the app does to a task: rename it, change its status, copy it, delete it. */
    protected update(id: number, change: Partial<Task>) {
        this.rows.update((current) =>
            current.map((row) => (row.id === id ? { ...row, ...change } : row)),
        );
    }

    protected rename(id: number, event: Event) {
        if (event.target instanceof HTMLInputElement) {
            this.update(id, { name: event.target.value });
        }
    }

    protected setStatus(id: number, status: unknown) {
        if (isStatus(status)) this.update(id, { status });
    }

    protected duplicate(id: number) {
        this.rows.update((current) => {
            const index = current.findIndex((row) => row.id === id);
            const original = current[index];
            if (!original) return current;
            const copy = {
                ...original,
                id: Math.max(...current.map((row) => row.id)) + 1,
                name: `${original.name} (copy)`,
            };
            return [
                ...current.slice(0, index + 1),
                copy,
                ...current.slice(index + 1),
            ];
        });
    }

    protected remove(id: number) {
        this.rows.update((current) => current.filter((row) => row.id !== id));
    }
}
