import {
    ChangeDetectionStrategy,
    Component,
    type ElementRef,
    signal,
    viewChild,
} from "@angular/core";
import {
    type CellPosition,
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import {
    LucideArrowDownToLine,
    LucideArrowUpToLine,
    LucideTrash2,
} from "@lucide/angular";
import {
    CONTEXT_MENU,
    type ContextMenuTrigger,
} from "#/components/ui/context-menu";
import { type Task, task, tasks } from "../_kit/tasks";
import { injectTouchHold } from "./inject-touch-hold";
import * as styles from "./styles";

// The menu is the app's (Fragiola UI's context menu, over Angular CDK's menu): the grid renders
// none. A body cell's own listeners say which row the menu acts on: `(contextmenu)` (a right
// click, a long press where the browser fires it), `(keydown.shift.f10)` and
// `(keydown.contextmenu)` (the menu keys on the focused cell), and `(touchstart)` (a long press,
// timed by the app: `inject-touch-hold.ts`). The menu opens only for a body cell, never over the
// header, and makes that cell active. Closing it focuses the grid, which hands focus to its
// active cell.

const columns: Column<Task, DataGridNode>[] = [
    { key: "id", name: "#", width: 72 },
    { key: "name", name: "Task", width: 240 },
    { key: "project", name: "Project", width: 120 },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assignee", width: 110 },
    { key: "due", name: "Due", width: 120 },
];

@Component({
    selector: "example-context-menu",
    imports: [
        DATA_GRID,
        CONTEXT_MENU,
        LucideArrowUpToLine,
        LucideArrowDownToLine,
        LucideTrash2,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span>
                    Right-click a row, or press
                    <kbd [class]="styles.key">Shift</kbd>+<kbd [class]="styles.key">F10</kbd>
                    on a cell
                </span>
                <!-- the app's live region: what the last action did -->
                <span role="status" [class]="styles.status">{{ announcement() }}</span>
            </div>
            <div
                [kitContextMenuTrigger]="menu"
                #trigger="kitContextMenuTrigger"
                (openChange)="openChange($event)"
                (touchmove)="releaseTouch()"
                (touchend)="releaseTouch()"
                (touchcancel)="releaseTouch()"
                [class]="styles.trigger"
            >
                <div
                    dataGridRoot
                    [(activePosition)]="active"
                    [columns]="columns"
                    [rows]="rows()"
                    [rowKey]="rowKey"
                    [rowHeight]="36"
                    [class]="styles.root"
                >
                    <div dataGridGrid #gridElement aria-label="Tasks" [class]="styles.grid">
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
                                        <!-- the row a menu would act on: a right click, the
                                             menu keys, or a touch that may become a long press -->
                                        <div
                                            [dataGridCell]="cell"
                                            [class]="styles.cell(target()?.rowIndex === cell.rowIndex)"
                                            (contextmenu)="press(cell)"
                                            (keydown.shift.f10)="press(cell)"
                                            (keydown.contextmenu)="press(cell)"
                                            (touchstart)="touchCell($event, cell)"
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
            <ng-template #menu>
                <div kitContextMenuContent>
                    @if (target(); as at) {
                        <div kitContextMenuItem (select)="insert(at.rowIndex, at.columnIndex)">
                            <svg lucideArrowUpToLine aria-hidden="true"></svg>
                            Insert row above
                        </div>
                        <div kitContextMenuItem (select)="insert(at.rowIndex + 1, at.columnIndex)">
                            <svg lucideArrowDownToLine aria-hidden="true"></svg>
                            Insert row below
                        </div>
                        <div kitContextMenuSeparator></div>
                        <div
                            kitContextMenuItem
                            [class]="styles.danger"
                            [disabled]="rows().length === 1"
                            (select)="remove(at.rowIndex, at.columnIndex)"
                        >
                            <svg lucideTrash2 aria-hidden="true"></svg>
                            Delete row
                        </div>
                    }
                </div>
            </ng-template>
        </div>
    `,
})
export default class ContextMenuExample {
    protected readonly styles = styles;

    readonly columns = columns;
    // the app's rows: the menu changes them, the grid shows them
    readonly rows = signal<readonly Task[]>(tasks(200));
    private nextId = this.rows().length + 1;
    readonly target = signal<CellPosition | null>(null);
    // the active cell, controlled: the menu makes its cell active, and a change moves it
    readonly active = signal<CellPosition | null | undefined>(undefined);
    // the cell a context menu event came from, until the menu asks to open
    private pressed: CellPosition | null = null;
    readonly announcement = signal("");

    private readonly gridElement =
        viewChild.required<ElementRef<HTMLElement>>("gridElement");
    private readonly trigger =
        viewChild.required<ContextMenuTrigger>("trigger");
    // a long press opens the menu at the touch's point
    private readonly touch = injectTouchHold((point) =>
        this.trigger().openAt(point),
    );

    readonly rowKey = (row: Task) => row.id;

    /** Records the cell a context menu would open for. */
    press(cell: CellPosition) {
        this.pressed = {
            rowIndex: cell.rowIndex,
            columnIndex: cell.columnIndex,
        };
    }

    /** A touch on a cell: the row a long press would act on, and the press timed. */
    touchCell(event: TouchEvent, cell: CellPosition) {
        this.press(cell);
        this.touch.hold(event);
    }

    /** The touch moved or ended: no long press, and no row left for a later one. */
    releaseTouch() {
        this.touch.release();
        this.pressed = null;
    }

    openChange(open: boolean) {
        if (open) {
            // the menu opens for a body cell only (`pressed`, set by its listener first), and
            // makes it the active cell; elsewhere (the header) it closes as it opens
            const at = this.pressed;
            this.pressed = null;
            if (!at) {
                this.trigger().close();
                return;
            }
            this.active.set(at);
            this.target.set(at);
            return;
        }
        this.target.set(null);
        // closed, focus goes to the grid (React's `finalFocus`) once the rows a menu item changed
        // are on screen (the grid renders them in a microtask after the app's): the grid hands it
        // to its active cell
        setTimeout(() => this.gridElement().nativeElement.focus());
    }

    /**
     * Changes the rows and, with them, the active cell (the root's `[(activePosition)]`: both reach
     * the grid together); `null` (no row left) clears it, and the menu's focus goes to the grid
     * itself.
     */
    private change(
        next: readonly Task[],
        active: CellPosition | null,
        what: string,
    ) {
        this.rows.set(next);
        this.active.set(active);
        this.announcement.set(what);
    }

    insert(at: number, columnIndex: number) {
        // a new task, its id the next one
        const row = task(this.nextId - 1);
        this.nextId += 1;
        const rows = this.rows();
        this.change(
            [...rows.slice(0, at), row, ...rows.slice(at)],
            { rowIndex: at, columnIndex },
            `Inserted task ${row.id} at row ${at + 1}.`,
        );
    }

    remove(at: number, columnIndex: number) {
        const rows = this.rows();
        const removed = rows[at];
        const next = [...rows.slice(0, at), ...rows.slice(at + 1)];
        this.change(
            next,
            // the row now at its place, else the one above; none left, no active cell
            next.length === 0
                ? null
                : { rowIndex: Math.min(at, next.length - 1), columnIndex },
            `Deleted task ${removed?.id}.`,
        );
    }
}
