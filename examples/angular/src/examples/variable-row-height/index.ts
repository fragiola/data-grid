import {
    ChangeDetectionStrategy,
    Component,
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
import { hash, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(100_000);

/** How many lines of notes a row has: its height follows. */
const lines = (index: number) => 1 + hash(index + 99, 4);

/** A row's height in pixels, from its index: the grid sums these to place every row. */
const rowHeight = (index: number) => 16 + lines(index) * 20;

const NOTES = [
    "Prefers asynchronous reviews.",
    "Owns the release checklist this quarter.",
    "Mentoring two new hires.",
    "On call next week.",
];

@Component({
    selector: "example-variable-row-height",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div
                dataGridRoot
                [columns]="columns"
                [rows]="rows"
                [rowKey]="rowKey"
                [rowHeight]="rowHeight"
                [class]="styles.root"
            >
                <ng-template #notesCell [dataGridTemplate]="cellContext" let-rowIndex="rowIndex">
                    @for (note of notesOf(rowIndex); track note) {
                        <span [class]="styles.note">{{ note }}</span>
                    }
                </ng-template>
                <div dataGridGrid aria-label="People and notes" [class]="styles.grid">
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
export default class VariableRowHeight {
    protected readonly styles = styles;
    protected readonly cellContext = contextOf<CellTemplateProps<Person>>();
    private readonly notesCell =
        viewChild.required<
            TemplateRef<TemplateContext<CellTemplateProps<Person>>>
        >("notesCell");

    readonly rows = rows;
    readonly rowHeight = rowHeight;

    readonly columns: Column<Person, DataGridNode>[] = [
        { key: "id", name: "#", width: 80 },
        { key: "name", name: "Name", width: 180 },
        { key: "team", name: "Team", width: 120 },
        {
            key: "notes",
            name: "Notes",
            width: 360,
            // one note per line, as many as the row has
            renderCell: (props) => templateContent(this.notesCell(), props),
        },
    ];

    readonly rowKey = (row: Person) => row.id;

    protected notesOf(rowIndex: number): string[] {
        return NOTES.slice(0, lines(rowIndex));
    }
}
