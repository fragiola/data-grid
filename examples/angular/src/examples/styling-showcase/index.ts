import {
    ChangeDetectionStrategy,
    Component,
    computed,
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
import { ClickableButton } from "#/components/atoms/clickable";
import { type Project, projects, STATUS_LABELS } from "../_kit/portfolio";
import * as styles from "./styles";

const rows = projects(300);

/** A body cell's template, typed by the props a renderer hands it. */
type CellTemplate = TemplateRef<TemplateContext<CellTemplateProps<Project>>>;

// The columns draw through the preset in use (their templates read it, inside the root): the
// markup never changes, only classes.

@Component({
    selector: "example-styling-showcase",
    imports: [DATA_GRID, ClickableButton],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <fieldset [class]="styles.toolbar">
                <legend [class]="styles.legend">Style</legend>
                @for (key of styles.PRESET_NAMES; track key) {
                    <button
                        kitClickable
                        size="sm"
                        variant="ghost"
                        [attr.aria-pressed]="key === name()"
                        [class]="styles.presetButton"
                        (click)="name.set(key)"
                    >
                        {{ styles.PRESETS[key].title }}
                    </button>
                }
            </fieldset>
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="preset().rowHeight"
                [defaultActivePosition]="{ rowIndex: 0, columnIndex: 1 }"
                [class]="preset().root"
                [attr.data-preset]="name()"
            >
                <ng-template #status [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="preset().status(row.status)">{{ STATUS_LABELS[row.status] }}</span>
                </ng-template>
                <ng-template #delta [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="preset().delta(row.delta)">{{ signed(row.delta) }}</span>
                </ng-template>
                <ng-template #shipped [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="preset().shipped(row.shipped)">{{ row.shipped ? "✓" : "✗" }}</span>
                </ng-template>
                <ng-template #tag [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="preset().tag(row.tag)">{{ row.tag }}</span>
                </ng-template>
                <div dataGridGrid aria-label="Projects">
                    <div *dataGridHeader [class]="preset().header">
                        <div dataGridHeaderRow [class]="preset().headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div
                                    [dataGridHeaderCell]="cell"
                                    [class]="preset().headerCell(styles.columnKey(cell.key))"
                                >
                                    <ng-container *dataGridCellContent />
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="preset().row(row, row.row?.status)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div
                                        [dataGridCell]="cell"
                                        [class]="
                                            styles.cellClass(
                                                preset(),
                                                styles.columnKey(cell.column.key),
                                                cell.row?.score
                                            )
                                        "
                                    >
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
export default class StylingShowcase {
    protected readonly styles = styles;
    protected readonly STATUS_LABELS = STATUS_LABELS;
    protected readonly cellContext = contextOf<CellTemplateProps<Project>>();

    readonly rows = rows;
    readonly rowKey = (row: Project) => row.id;

    readonly name = signal<styles.PresetName>("spreadsheet");
    protected readonly preset = computed(() => styles.PRESETS[this.name()]);

    @ViewChild("status", { static: true })
    private readonly status!: CellTemplate;
    @ViewChild("delta", { static: true })
    private readonly delta!: CellTemplate;
    @ViewChild("shipped", { static: true })
    private readonly shipped!: CellTemplate;
    @ViewChild("tag", { static: true })
    private readonly tag!: CellTemplate;

    readonly columns: Column<Project, DataGridNode>[] = [
        { key: "id", name: "#", width: 64 },
        { key: "name", name: "Project", width: 160 },
        { key: "owner", name: "Owner", width: 170 },
        {
            key: "status",
            name: "Status",
            width: 120,
            renderCell: (props) => templateContent(this.status, props),
        },
        { key: "score", name: "Health", width: 100 },
        {
            key: "delta",
            name: "Change",
            width: 96,
            renderCell: (props) => templateContent(this.delta, props),
        },
        {
            key: "shipped",
            name: "Shipped",
            width: 90,
            renderCell: (props) => templateContent(this.shipped, props),
        },
        {
            key: "tag",
            name: "Area",
            width: 120,
            renderCell: (props) => templateContent(this.tag, props),
        },
    ];

    protected signed(delta: number): string {
        return delta > 0 ? `+${delta}` : String(delta);
    }
}
