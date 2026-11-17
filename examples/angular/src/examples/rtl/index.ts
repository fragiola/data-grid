import {
    ChangeDetectionStrategy,
    Component,
    computed,
    signal,
} from "@angular/core";
import {
    type ColumnOrGroup,
    DATA_GRID,
    type DataGridNode,
    type GridDirection,
    type HeaderCellInfo,
} from "@fragiola/data-grid-angular";
import { columnPinning } from "@fragiola/data-grid-angular/column-pinning";
import { columnReorder } from "@fragiola/data-grid-angular/column-reorder";
import {
    columnResize,
    DataGridColumnResizer,
} from "@fragiola/data-grid-angular/column-resize";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { SWITCH } from "#/components/ui/switch";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(1_000);

// An Arabic table, read from the right: the name pinned at the start (the right edge), the
// salary at the end (the left edge), the columns between them resizable and reorderable, the
// email taking what a wide view leaves. The
// grid mirrors itself; the app's styles use logical sides (start and end) so they mirror too.
const columns: ColumnOrGroup<Person, DataGridNode>[] = [
    {
        key: "name",
        name: "الاسم",
        width: 180,
        pinned: "start",
        resizable: true,
        minWidth: 120,
    },
    {
        key: "contact",
        name: "التواصل",
        reorderable: true,
        children: [
            {
                key: "email",
                name: "البريد الإلكتروني",
                width: 260,
                // the rest of a wide view: the salary pinned at its end edge
                flex: 1,
                resizable: true,
                reorderable: true,
            },
            {
                key: "city",
                name: "المدينة",
                width: 140,
                resizable: true,
                reorderable: true,
            },
        ],
    },
    {
        key: "team",
        name: "الفريق",
        width: 140,
        resizable: true,
        reorderable: true,
    },
    {
        key: "joined",
        name: "تاريخ الانضمام",
        width: 150,
        resizable: true,
        reorderable: true,
    },
    {
        key: "salary",
        name: "الراتب",
        width: 130,
        pinned: "end",
        resizable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
        meta: { numeric: true },
    },
];

let ids = 0;

// Each header cell renders its own content, then its handle (`*dataGridColumnResizer`), at the
// edge it moves (`state.edge`): the end edge, the left one right to left, dragged toward the end
// (to the left there) to grow its column; for the salary, pinned at the end, its start edge,
// dragged toward the start. Its props make it a separator, a focusable one (the APG's splitter),
// which an <hr> cannot be.

@Component({
    selector: "example-rtl",
    imports: [DATA_GRID, DataGridColumnResizer, SWITCH],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span [class]="styles.direction">
                    <button
                        kitSwitch
                        [attr.aria-labelledby]="directionLabel"
                        [checked]="direction() === 'rtl'"
                        (checkedChange)="direction.set($event ? 'rtl' : 'ltr')"
                    >
                        <span kitSwitchThumb></span>
                    </button>
                    <span [id]="directionLabel">Right to left</span>
                </span>
                <span>
                    <kbd [class]="styles.key">{{ arrows().next }}</kbd> the next column,
                    <kbd [class]="styles.key">{{ arrows().previous }}</kbd> the previous one
                </span>
                <span>
                    <kbd [class]="styles.key">Ctrl</kbd>+<kbd [class]="styles.key">Shift</kbd>+<kbd
                        [class]="styles.key"
                        >{{ arrows().next }}</kbd
                    >
                    moves a header toward the end
                </span>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [direction]="direction()"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="الموظفون" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <ng-template [dataGridHeaderRows]="columns" let-row>
                            <div [dataGridHeaderRow]="row" [class]="styles.headerRow(row)">
                                <ng-template [dataGridHeaderCells]="columns" let-cell>
                                    <div [dataGridHeaderCell]="cell" [class]="styles.headerCell(cell)">
                                        <!-- its own content, then its handle -->
                                        <ng-container *dataGridCellContent />
                                        <div
                                            *dataGridColumnResizer="cell; let state"
                                            [attr.aria-label]="resizeLabel(cell)"
                                            [class]="styles.resizer(state)"
                                        ></div>
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <div
                                        [dataGridCell]="cell"
                                        [class]="cell.column.meta?.numeric ? styles.numeric(cell) : styles.cell(cell)"
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
export default class Rtl {
    // the features the grid installs: cell navigation (the keys, the active cell, the tab stop),
    // column resizing (its handles, keys and fits), column reordering (a header cell's drag and
    // keys), pinned columns (without it, every column scrolls)
    readonly features = [
        navigation(),
        columnResize(),
        columnReorder(),
        columnPinning(),
    ];
    protected readonly styles = styles;

    readonly rows = rows;

    readonly columns = columns;

    readonly direction = signal<GridDirection>("rtl");
    readonly directionLabel = `rtl-direction-${++ids}`;

    // the arrows follow the reading direction: the next column is to the left right to left
    protected readonly arrows = computed(() =>
        this.direction() === "rtl"
            ? { next: "←", previous: "→" }
            : { next: "→", previous: "←" },
    );

    protected resizeLabel(cell: HeaderCellInfo<Person>): string {
        return `تغيير عرض ${(cell.group ?? cell.column).name ?? cell.key}`;
    }

    readonly rowKey = (row: Person) => row.id;
}
