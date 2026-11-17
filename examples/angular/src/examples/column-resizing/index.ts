import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import {
    type ColumnOrGroup,
    type ColumnWidths,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    type HeaderCellInfo,
} from "@fragiola/data-grid-angular";
import { LucideRotateCcw } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { formatMoney, type Person, people } from "../_kit/data";
import { injectDragged } from "./inject-dragged";
import * as styles from "./styles";
import { WidthsReadout } from "./widths-readout";

const rows = people(1_000);

// "#" keeps its width (not resizable); the others resize within their limits (40px at least by
// default). Name is pinned, and a group's handle resizes its columns together.
const columns: ColumnOrGroup<Person, DataGridNode>[] = [
    {
        key: "id",
        name: "#",
        width: 64,
        pinned: "start",
        meta: { numeric: true },
    },
    {
        key: "name",
        name: "Name",
        width: 180,
        pinned: "start",
        resizable: true,
        minWidth: 120,
        maxWidth: 320,
    },
    {
        key: "contact",
        name: "Contact",
        children: [
            {
                key: "email",
                name: "Email",
                width: 240,
                resizable: true,
                minWidth: 160,
            },
            { key: "city", name: "City", width: 140, resizable: true },
        ],
    },
    {
        key: "work",
        name: "Work",
        children: [
            {
                key: "team",
                name: "Team",
                width: 120,
                resizable: true,
                minWidth: 80,
                maxWidth: 200,
            },
            { key: "joined", name: "Joined", width: 120, resizable: true },
            {
                key: "salary",
                name: "Salary",
                width: 120,
                resizable: true,
                minWidth: 90,
                maxWidth: 180,
                renderCell: ({ row }) => formatMoney(row.salary),
                meta: { numeric: true },
            },
        ],
    },
];

/** Every column's and group's name by key, for the readout. */
function namesOf(
    entries: readonly ColumnOrGroup<Person, DataGridNode>[],
): Map<string, string> {
    const names = new Map<string, string>();
    const visit = (list: readonly ColumnOrGroup<Person, DataGridNode>[]) => {
        for (const entry of list) {
            names.set(entry.key, entry.name ?? entry.key);
            if (entry.children) visit(entry.children);
        }
    };
    visit(entries);
    return names;
}

const NAMES = namesOf(columns);

// Each header cell renders its own content, then its handle: `*dataGridColumnResizer` on an
// element of the app's, which gives it its name, its place and its look. Under a cell that does
// not resize, there is none. Its props make it a separator, a focusable one (the APG's splitter),
// which an <hr> cannot be.

@Component({
    selector: "example-column-resizing",
    imports: [DATA_GRID, ClickableButton, LucideRotateCcw, WidthsReadout],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span>
                    <kbd [class]="styles.key">F2</kbd> on a header, then
                    <kbd [class]="styles.key">←</kbd><kbd [class]="styles.key">→</kbd>
                    (<kbd [class]="styles.key">Shift</kbd> by 50)
                </span>
                <span>
                    <kbd [class]="styles.key">Esc</kbd> while dragging cancels, a
                    double click fits the content
                </span>
                <span
                    exampleWidthsReadout
                    [dragged]="dragged()"
                    [widths]="widths()"
                    [names]="names"
                    [class]="styles.readout"
                    data-testid="widths"
                ></span>
                <!-- the columns go back to their own width -->
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    [disabled]="resetDisabled()"
                    (click)="widths.set({})"
                >
                    <svg lucideRotateCcw aria-hidden="true"></svg>
                    Reset widths
                </button>
            </div>
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [columnWidths]="widths()"
                (columnWidthsChange)="widths.set($event)"
                [gridRef]="gridRef"
                [class]="styles.root"
            >
                <div dataGridGrid aria-label="People" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <ng-template [dataGridHeaderRows]="columns" let-row>
                            <div [dataGridHeaderRow]="row" [class]="styles.headerRow(row)">
                                <ng-template [dataGridHeaderCells]="columns" let-cell>
                                    <div [dataGridHeaderCell]="cell" [class]="styles.headerCell(cell)">
                                        <!-- its own content, then its handle -->
                                        <ng-container *dataGridCellContent />
                                        <div
                                            *dataGridColumnResizer="cell"
                                            [attr.aria-label]="resizeLabel(cell)"
                                            [class]="styles.resizer"
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
export default class ColumnResizing {
    protected readonly styles = styles;

    readonly rows = rows;
    readonly columns = columns;
    readonly names = NAMES;
    readonly rowKey = (row: Person) => row.id;

    // the grid resizes; the app keeps the widths (to show them, to reset them, to save them)
    readonly widths = signal<ColumnWidths>({});
    readonly gridRef = createDataGridRef<Person>();
    readonly dragged = injectDragged(this.gridRef);

    protected resetDisabled(): boolean {
        return Object.keys(this.widths()).length === 0;
    }

    /** a handle's name: its group's or its column's */
    protected resizeLabel(cell: HeaderCellInfo<Person>): string {
        return `Resize ${(cell.group ?? cell.column).name ?? cell.key}`;
    }
}
