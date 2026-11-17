import {
    ChangeDetectionStrategy,
    Component,
    effect,
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
import { ClickableButton } from "#/components/atoms/clickable";
import { type Task, tasks } from "../_kit/tasks";
import * as styles from "./styles";

const ROWS = tasks(500);

const HEIGHTS = [
    { label: "Small", height: 32 },
    { label: "Medium", height: 52 },
    { label: "Large", height: 76 },
] as const;

// The grid positions each row (its top and height, structural style) from `rowHeight`: a new
// height lays every row out again in one render. While that change is in flight (`easingTo`,
// set with the new height and cleared once the transition is over), the rows' own CSS
// transition on `top` and `height` (styles.ts) eases them there. Only then: a scroll that
// renders other rows, or moves them, never animates. With reduced motion they move at once.

/** How long the rows ease, in ms: the rows' `duration-300` (styles.ts). */
const DURATION = 300;

@Component({
    selector: "example-animated-row-heights",
    imports: [DATA_GRID, ClickableButton],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <fieldset [class]="styles.toolbar">
                <legend [class]="styles.legend">Row height</legend>
                @for (option of HEIGHTS; track option.label) {
                    <button
                        kitClickable
                        size="sm"
                        [variant]="rowHeight() === option.height ? 'solid' : 'outline'"
                        [attr.aria-pressed]="rowHeight() === option.height"
                        (click)="choose(option.height)"
                    >
                        {{ option.label }}
                    </button>
                }
            </fieldset>
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="ROWS"
                [rowKey]="rowKey"
                [rowHeight]="rowHeight()"
                [class]="styles.root"
            >
                <ng-template #taskCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.stack">
                        <span>{{ row.name }}</span>
                        <span [class]="styles.secondary">{{ row.project }}</span>
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
                            <div [dataGridRow]="row" [class]="styles.row(row, easingTo() !== null)">
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
export default class AnimatedRowHeights {
    protected readonly styles = styles;
    protected readonly HEIGHTS = HEIGHTS;
    protected readonly ROWS = ROWS;
    protected readonly cellContext = contextOf<CellTemplateProps<Task>>();
    private readonly taskCell =
        viewChild.required<
            TemplateRef<TemplateContext<CellTemplateProps<Task>>>
        >("taskCell");

    readonly columns: Column<Task, DataGridNode>[] = [
        { key: "id", name: "#", width: 64 },
        {
            key: "name",
            name: "Task",
            width: 240,
            // two lines: the project shows as the row grows tall enough for it
            renderCell: (props) => templateContent(this.taskCell(), props),
        },
        { key: "priority", name: "Priority", width: 110 },
        { key: "status", name: "Status", width: 130 },
        { key: "assignee", name: "Assignee", width: 110 },
        { key: "due", name: "Due", width: 120 },
    ];

    protected readonly rowHeight = signal<number>(HEIGHTS[0].height);
    // the height the rows are easing to, until the transition is over
    protected readonly easingTo = signal<number | null>(null);

    constructor() {
        effect((onCleanup) => {
            if (this.easingTo() === null) return;
            // a little past the transition's end, so it is never cut short
            const timer = setTimeout(
                () => this.easingTo.set(null),
                DURATION + 50,
            );
            onCleanup(() => clearTimeout(timer));
        });
    }

    protected choose(height: number): void {
        this.rowHeight.set(height);
        // the same render: the transition applies to this change
        this.easingTo.set(height);
    }

    readonly rowKey = (row: Task) => row.id;
}
