import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import { LucidePlus, LucideTrash2, LucideUsersRound } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { type Person, people } from "../_kit/data";
import * as styles from "./styles";

const SAMPLE = people(50);

@Component({
    selector: "example-empty-state",
    imports: [
        DATA_GRID,
        ClickableButton,
        LucidePlus,
        LucideTrash2,
        LucideUsersRound,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span [class]="styles.count" data-testid="row-count">{{ rows().length }} people</span>
                <button
                    kitClickable
                    size="sm"
                    variant="ghost"
                    [disabled]="rows().length === 0"
                    (click)="clearAll()"
                >
                    <svg lucideTrash2 aria-hidden="true"></svg>
                    Clear all
                </button>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [columns]="columns"
                [rows]="rows()"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [class]="styles.root"
            >
                <div #grid dataGridGrid aria-label="People" [class]="styles.grid">
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
                    <!-- the grid's cell while it has no rows: the content laid out in it -->
                    <div *dataGridEmpty [class]="styles.empty" data-testid="empty">
                        <div [class]="styles.illustration">
                            <svg lucideUsersRound aria-hidden="true"></svg>
                        </div>
                        <p [class]="styles.emptyTitle">No people yet</p>
                        <p [class]="styles.emptyText">
                            Add a few sample rows to see the grid fill up, then
                            clear them to come back here.
                        </p>
                        <button kitClickable size="sm" (click)="addSample(grid)">
                            <svg lucidePlus aria-hidden="true"></svg>
                            Add sample rows
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class EmptyState {
    // cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
    readonly features = [navigation()];
    protected readonly styles = styles;

    readonly columns: Column<Person, DataGridNode>[] = [
        { key: "id", name: "#", width: 64 },
        { key: "name", name: "Name", width: 180 },
        { key: "email", name: "Email", width: 260 },
        { key: "city", name: "City", width: 140 },
        { key: "team", name: "Team", width: 120 },
    ];

    protected readonly rows = signal<Person[]>([]);

    readonly rowKey = (row: Person) => row.id;

    protected clearAll(): void {
        this.rows.set([]);
    }

    /** `grid`: the grid's element (a template reference on it) */
    protected addSample(grid: HTMLElement): void {
        this.rows.set(SAMPLE);
        // the button goes away with the empty state: keep focus in the grid
        grid.focus();
    }
}
