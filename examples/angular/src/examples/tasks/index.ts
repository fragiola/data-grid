import {
    ChangeDetectionStrategy,
    Component,
    computed,
    signal,
    type TemplateRef,
    viewChild,
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
import { LucideStar } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { CHECKBOX } from "#/components/ui/checkbox";
import { type Task, tasks } from "../_kit/tasks";
import {
    type Checked,
    counts,
    FACETS,
    type FacetKey,
    filter,
    NONE,
    toggle,
} from "./facets";
import * as styles from "./styles";

const all = tasks(200);

const DATE = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
});

type TaskCell = TemplateRef<TemplateContext<CellTemplateProps<Task>>>;

@Component({
    selector: "example-tasks",
    imports: [DATA_GRID, ClickableButton, CHECKBOX, LucideStar],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <aside [class]="styles.sidebar" aria-label="Filters">
                <div [class]="styles.sidebarHeader">
                    <span [class]="styles.shown" data-testid="shown">
                        {{ rows().length }} of {{ all.length }} tasks
                    </span>
                    <button
                        kitClickable
                        size="sm"
                        variant="ghost"
                        [disabled]="!anyChecked()"
                        (click)="clear()"
                    >
                        Clear
                    </button>
                </div>
                @for (facet of FACETS; track facet.key) {
                    <fieldset [class]="styles.facet">
                        <legend [class]="styles.facetTitle">{{ facet.title }}</legend>
                        <!-- the checkbox is the control the label wraps -->
                        @for (value of facet.values; track value) {
                            <label [class]="styles.option">
                                <button
                                    kitCheckbox
                                    [checked]="checked()[facet.key].has(value)"
                                    (checkedChange)="toggleValue(facet.key, value)"
                                >
                                    <span kitCheckboxIndicator></span>
                                </button>
                                <span [class]="styles.optionLabel">{{ value }}</span>
                                <span [class]="styles.optionCount">
                                    {{ facetCounts()[facet.key].get(value) ?? 0 }}
                                </span>
                            </label>
                        }
                    </fieldset>
                }
            </aside>
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows()"
                [rowKey]="rowKey"
                [rowHeight]="40"
                [class]="styles.root"
            >
                <ng-template #priorityCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.priority(row.priority)">{{ row.priority }}</span>
                </ng-template>
                <ng-template #effectivenessCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.stars" role="img" [attr.aria-label]="row.effectiveness + ' of 5'">
                        @for (star of STARS; track star) {
                            <svg
                                lucideStar
                                aria-hidden="true"
                                [class]="styles.star(star <= row.effectiveness)"
                            ></svg>
                        }
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
                            <div [dataGridRow]="row" [class]="styles.row">
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
export default class Tasks {
    protected readonly styles = styles;
    protected readonly FACETS = FACETS;
    protected readonly STARS = [1, 2, 3, 4, 5];
    protected readonly all = all;
    protected readonly cellContext = contextOf<CellTemplateProps<Task>>();

    private readonly priorityCell =
        viewChild.required<TaskCell>("priorityCell");
    private readonly effectivenessCell =
        viewChild.required<TaskCell>("effectivenessCell");

    readonly columns: Column<Task, DataGridNode>[] = [
        { key: "name", name: "Name", width: 220 },
        { key: "project", name: "Project", width: 110 },
        {
            key: "priority",
            name: "Priority",
            width: 110,
            renderCell: (props) => templateContent(this.priorityCell(), props),
        },
        { key: "status", name: "Status", width: 130 },
        { key: "assignee", name: "Assigned to", width: 120 },
        {
            key: "due",
            name: "Due date",
            width: 120,
            renderCell: ({ row }) => DATE.format(new Date(row.due)),
        },
        {
            key: "effectiveness",
            name: "Effectiveness",
            width: 140,
            renderCell: (props) =>
                templateContent(this.effectivenessCell(), props),
        },
    ];

    protected readonly checked = signal<Checked>(NONE);
    // the grid gets the filtered rows: filtering is the app's (the external mode)
    protected readonly rows = computed(() => filter(all, this.checked()));
    protected readonly facetCounts = computed(() =>
        counts(all, this.checked()),
    );
    protected readonly anyChecked = computed(() =>
        FACETS.some(({ key }) => this.checked()[key].size > 0),
    );

    readonly rowKey = (row: Task) => row.id;

    protected clear() {
        this.checked.set(NONE);
    }

    protected toggleValue(key: FacetKey, value: string) {
        this.checked.update((current) => toggle(current, key, value));
    }
}
