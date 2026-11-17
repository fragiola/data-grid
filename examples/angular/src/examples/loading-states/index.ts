import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
    type OnInit,
    signal,
} from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { LucideRefreshCw, LucideTriangleAlert } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { SWITCH } from "#/components/ui/switch";
import { formatMoney, type Person, person } from "../_kit/data";
import * as styles from "./styles";

const COUNT = 40;
/** the skeleton rows the first load shows: about a screen's worth */
const SKELETON_ROWS = 12;
const LATENCY = 700;

/**
 * The app's request: the people after a delay, or a failure when asked to fail. Swap it for a
 * `fetch` to your API (or `HttpClient`); the states below do not change.
 */
function fetchPeople(fail: boolean): Promise<Person[]> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (fail) reject(new Error("The server did not answer."));
            else resolve(Array.from({ length: COUNT }, (_, i) => person(i)));
        }, LATENCY);
    });
}

/** What the app knows of its rows: nothing yet, some, and whether a request runs or failed. */
interface LoadState {
    readonly rows: readonly Person[] | null;
    readonly loading: boolean;
    readonly error: string | null;
}

let nextId = 0;

@Component({
    selector: "example-loading-states",
    imports: [
        DATA_GRID,
        ClickableButton,
        SWITCH,
        LucideRefreshCw,
        LucideTriangleAlert,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <button kitClickable size="sm" variant="outline" [disabled]="loading()" (click)="load()">
                    <svg lucideRefreshCw aria-hidden="true"></svg>
                    Refetch
                </button>
                <button kitClickable size="sm" variant="ghost" [disabled]="loading()" (click)="load(true)">
                    Start over
                </button>
                <span [class]="styles.fail">
                    <button kitSwitch [attr.aria-labelledby]="failLabel" [(checked)]="failNext">
                        <span kitSwitchThumb></span>
                    </button>
                    <span [id]="failLabel">Fail the next request</span>
                </span>
                <span [class]="styles.status" data-testid="status" aria-live="polite">{{ status() }}</span>
            </div>
            @if (error() && rows()) {
                <!-- a refetch that failed: the rows stay, the error and its retry above them -->
                <div [class]="styles.banner" role="alert" data-testid="banner">
                    <svg lucideTriangleAlert aria-hidden="true" [size]="16"></svg>
                    <span>Could not refresh: {{ error() }}</span>
                    <button kitClickable size="sm" variant="ghost" (click)="load()">Retry</button>
                </div>
            }
            <div
                dataGridRoot
                [columns]="columns"
                [rowCount]="rowCount()"
                [getRow]="getRow()"
                [rowKey]="rowKey"
                [rowHeight]="36"
                [class]="styles.root"
            >
                <div
                    dataGridGrid
                    aria-label="People"
                    [attr.aria-busy]="loading() || null"
                    [class]="styles.grid"
                >
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" [class]="styles.headerCell">
                                    <ng-container *dataGridCellContent />
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody [class]="styles.body(refreshing())">
                        <ng-template [dataGridRows]="columns" let-row>
                            <div [dataGridRow]="row" [class]="styles.row(row)">
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <!-- loaded, the cell's own content; not yet, a skeleton -->
                                    <div [dataGridCell]="cell" [class]="styles.cell">
                                        @if (cell.loaded) {
                                            <ng-container *dataGridCellContent />
                                        } @else {
                                            <span [class]="styles.skeleton"></span>
                                        }
                                    </div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                    <!-- the first load failed: the error and its retry, in the grid's own cell -->
                    <div *dataGridEmpty [class]="styles.error" data-testid="error">
                        <svg lucideTriangleAlert aria-hidden="true" [size]="28"></svg>
                        <p [class]="styles.errorTitle">The people could not be loaded</p>
                        <p [class]="styles.errorText">{{ error() }}</p>
                        <button kitClickable size="sm" [disabled]="loading()" (click)="load()">
                            <svg lucideRefreshCw aria-hidden="true"></svg>
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class LoadingStates implements OnInit {
    protected readonly styles = styles;

    readonly columns: Column<Person, DataGridNode>[] = [
        { key: "id", name: "#", width: 64 },
        { key: "name", name: "Name", width: 180 },
        { key: "email", name: "Email", width: 260 },
        { key: "city", name: "City", width: 130 },
        {
            key: "salary",
            name: "Salary",
            width: 120,
            renderCell: ({ row }) => formatMoney(row.salary),
        },
    ];

    private readonly state = signal<LoadState>({
        rows: null,
        loading: true,
        error: null,
    });
    // the next request fails: the app's switch, to see the error states
    protected readonly failNext = signal(false);
    protected readonly failLabel = `example-loading-fail-${++nextId}`;
    private request = 0;

    protected readonly rows = computed(() => this.state().rows);
    protected readonly loading = computed(() => this.state().loading);
    protected readonly error = computed(() => this.state().error);
    // the first load: skeleton rows, every one "not loaded yet" (`data-loading`); a failed one,
    // none (the empty state shows the error); then the rows, kept through a refetch
    protected readonly rowCount = computed(() => {
        const rows = this.rows();
        return rows ? rows.length : this.error() ? 0 : SKELETON_ROWS;
    });
    protected readonly getRow = computed(() => {
        const rows = this.rows();
        return (index: number) => rows?.[index];
    });
    protected readonly refreshing = computed(
        () => this.loading() && this.rows() !== null,
    );
    protected readonly status = computed(() =>
        this.loading()
            ? this.rows()
                ? "Refreshing…"
                : "Loading…"
            : this.error()
              ? "Failed"
              : `${this.rows()?.length ?? 0} people`,
    );

    readonly rowKey = (row: Person) => row.id;

    constructor() {
        // a request still running when the example goes away is dropped
        inject(DestroyRef).onDestroy(() => {
            this.request += 1;
        });
    }

    ngOnInit() {
        this.load();
    }

    /** Requests the rows; `fresh` drops the ones on screen first (a first load again). */
    protected load(fresh = false) {
        // an answer to a request the app has moved on from is dropped
        const id = ++this.request;
        this.state.update((current) => ({
            rows: fresh ? null : current.rows,
            loading: true,
            error: null,
        }));
        fetchPeople(this.failNext()).then(
            (rows) => {
                if (id === this.request) {
                    this.state.set({ rows, loading: false, error: null });
                }
            },
            (error: Error) => {
                if (id === this.request) {
                    this.state.update((current) => ({
                        ...current,
                        loading: false,
                        error: error.message,
                    }));
                }
            },
        );
    }
}
