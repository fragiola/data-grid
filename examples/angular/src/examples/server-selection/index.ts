import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    signal,
    type TemplateRef,
    untracked,
    ViewChild,
} from "@angular/core";
import {
    type CellTemplateProps,
    type Column,
    contextOf,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
    injectDataGrid,
    type RowKey,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import {
    DataGridRowSelection,
    rowSelection,
} from "@fragiola/data-grid-angular/row-selection";
import {
    LucideChevronLeft,
    LucideChevronRight,
    LucideDownload,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { formatNumber, type Person, person } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";
import { RequestLog } from "./request-log";
import { SelectAll } from "./select-all";
import { SelectRow } from "./select-row";
import * as styles from "./styles";

const TOTAL = 10_000;
const PAGE_SIZE = 50;
const PAGES = Math.ceil(TOTAL / PAGE_SIZE);

/** The pretend server: it holds every person and sends a page at a time. */
const api = createFakeApi(300);

/**
 * The app's selection over the server's rows, never a list of ten thousand keys: every row but
 * `keys` (`all`), or only `keys`. The grid holds the page's part of it.
 */
interface Selection {
    readonly all: boolean;
    readonly keys: ReadonlySet<RowKey>;
}

const NONE: Selection = { all: false, keys: new Set() };

const isSelected = (selection: Selection, key: RowKey) =>
    selection.all !== selection.keys.has(key);

const countOf = (selection: Selection) =>
    selection.all ? TOTAL - selection.keys.size : selection.keys.size;

/** What a selection reads as in a request: what the server needs to act on it. */
const describe = (selection: Selection) =>
    selection.all
        ? selection.keys.size === 0
            ? "every person"
            : `every person but ${formatNumber(selection.keys.size)}`
        : `${formatNumber(selection.keys.size)} people`;

// the features the grid installs: cell navigation (the keys, the active cell, the tab stop),
// row selection
const FEATURES = [navigation(), rowSelection()];

@Component({
    selector: "example-server-selection",
    imports: [
        DATA_GRID,
        ClickableButton,
        RequestLog,
        SelectAll,
        SelectRow,
        LucideChevronLeft,
        LucideChevronRight,
        LucideDownload,
        DataGridRowSelection,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <span [class]="styles.count" data-testid="selected-count">
                    {{ formatNumber(count()) }} of {{ formatNumber(TOTAL) }} selected
                </span>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    [disabled]="count() === 0"
                    (click)="exportSelection()"
                >
                    <svg lucideDownload aria-hidden="true"></svg>
                    Export
                </button>
                <span [class]="styles.exported" data-testid="exported">{{ exported() }}</span>
            </div>
            @if (selection().all) {
                <div [class]="styles.banner" data-testid="banner">
                    <span>
                        All {{ formatNumber(count()) }} people are selected{{ leftOut() }}.
                    </span>
                    <button kitClickable size="sm" variant="ghost" (click)="clearSelection()">
                        Clear selection
                    </button>
                </div>
            } @else if (pageSelected()) {
                <div [class]="styles.banner" data-testid="banner">
                    <span>The {{ rows().length }} people on this page are selected.</span>
                    <button kitClickable size="sm" variant="ghost" (click)="selectEveryRow()">
                        Select all {{ formatNumber(TOTAL) }}
                    </button>
                </div>
            }
            <div [class]="styles.layout">
                <div
                    dataGridRoot
                    [features]="features"
                    [columns]="columns"
                    [rows]="rows()"
                    [rowKey]="rowKey"
                    [rowHeight]="40"
                    dataGridRowSelection
                    rowSelection="multiple"
                    [selectedRowKeys]="selectedRowKeys()"
                    (selectedRowKeysChange)="setSelected($event)"
                    [gridRef]="gridRef"
                    [class]="styles.root"
                >
                    <ng-template #selectAll [dataGridTemplate]="headerContext">
                        <example-select-all [count]="count()" [total]="TOTAL" (toggle)="toggleAll($event)" />
                    </ng-template>
                    <ng-template #selectRow [dataGridTemplate]="cellContext" let-row="row" let-rowIndex="rowIndex">
                        <example-select-row [rowIndex]="rowIndex" [name]="row.name" />
                    </ng-template>
                    <div dataGridGrid aria-label="People" [class]="styles.grid">
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
                <example-request-log [api]="api" />
            </div>
            <nav [class]="styles.pager" aria-label="Pages">
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    aria-label="Previous page"
                    [disabled]="pageIndex() === 0"
                    (click)="pageIndex.set(Math.max(0, pageIndex() - 1))"
                >
                    <svg lucideChevronLeft aria-hidden="true"></svg>
                </button>
                <span [class]="styles.pageOf" data-testid="page">Page {{ pageIndex() + 1 }} of {{ PAGES }}</span>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    aria-label="Next page"
                    [disabled]="pageIndex() >= PAGES - 1"
                    (click)="pageIndex.set(Math.min(PAGES - 1, pageIndex() + 1))"
                >
                    <svg lucideChevronRight aria-hidden="true"></svg>
                </button>
            </nav>
        </div>
    `,
})
export default class ServerSelection {
    readonly features = FEATURES;
    protected readonly styles = styles;
    protected readonly formatNumber = formatNumber;
    protected readonly TOTAL = TOTAL;
    protected readonly PAGES = PAGES;
    protected readonly Math = Math;
    protected readonly api = api;
    protected readonly headerContext = contextOf<object>();
    protected readonly cellContext = contextOf<CellTemplateProps<Person>>();

    @ViewChild("selectAll", { static: true })
    private readonly selectAll!: TemplateRef<TemplateContext<object>>;
    @ViewChild("selectRow", { static: true })
    private readonly selectRow!: TemplateRef<
        TemplateContext<CellTemplateProps<Person>>
    >;

    readonly columns: Column<Person, DataGridNode>[] = [
        {
            key: "select",
            width: 48,
            renderHeaderCell: () => templateContent(this.selectAll, {}),
            renderCell: (props) => templateContent(this.selectRow, props),
        },
        { key: "id", name: "#", width: 80 },
        { key: "name", name: "Name", width: 180 },
        { key: "email", name: "Email", width: 260 },
        { key: "team", name: "Team", width: 120 },
    ];

    protected readonly pageIndex = signal(0);
    protected readonly rows = signal<readonly Person[]>([]);
    protected readonly selection = signal<Selection>(NONE);
    protected readonly exported = signal("");
    readonly gridRef = createDataGridRef<Person, typeof FEATURES>();
    private readonly grid = injectDataGrid(this.gridRef);

    protected readonly count = computed(() => countOf(this.selection()));
    protected readonly leftOut = computed(() => {
        const size = this.selection().keys.size;
        return size > 0 ? ` (${formatNumber(size)} left out)` : "";
    });
    // the grid's part of the selection: the page's selected rows
    protected readonly selectedRowKeys = computed(() => {
        const selection = this.selection();
        return this.rows()
            .filter((row) => isSelected(selection, row.id))
            .map((row) => row.id);
    });
    protected readonly pageSelected = computed(
        () =>
            this.rows().length > 0 &&
            this.selectedRowKeys().length === this.rows().length,
    );

    readonly rowKey = (row: Person) => row.id;

    constructor() {
        // the page on screen, fetched again when it changes; an answer to a page the app has
        // moved on from is dropped
        effect((onCleanup) => {
            const index = this.pageIndex();
            let current = true;
            untracked(() =>
                api
                    .fetchPage(index, PAGE_SIZE, TOTAL, person)
                    .then((answer) => {
                        if (current) this.rows.set(answer);
                    }),
            );
            onCleanup(() => {
                current = false;
            });
        });

        // "Select every row" (Ctrl/⌘+A, the header's box) is the server's: the grid only holds a
        // page, so a middleware turns the command, once it went through (not refused, not a dry
        // run), into the app's own "all"; the grid selects the page's rows (what it shows of it)
        effect((onCleanup) => {
            const grid = this.grid();
            if (!grid) return;
            onCleanup(
                grid.model.use((ctx, next) => {
                    const result = next();
                    if (
                        ctx.command === "selected-rows.select-all" &&
                        result.ok &&
                        !ctx.dryRun
                    ) {
                        this.selection.set({ all: true, keys: new Set() });
                    }
                    return result;
                }),
            );
        });
    }

    protected toggleAll(checked: boolean) {
        if (checked) this.selectEveryRow();
        else this.clearSelection();
    }

    protected exportSelection() {
        // the server gets the selection as the app keeps it, not ten thousand keys
        const what = describe(this.selection());
        const total = this.count();
        api.fetchQuery(`export ${what}`, () => ({ rows: [], total })).then(() =>
            this.exported.set(`Exported ${what}`),
        );
    }

    protected clearSelection() {
        this.selection.set(NONE);
    }

    protected selectEveryRow() {
        this.grid()?.model.run("selected-rows.select-all", {});
    }

    protected setSelected(next: readonly RowKey[]) {
        // the page's rows as the grid has them now; the other pages' stay
        const chosen = new Set(next);
        this.selection.update((current) => {
            const keys = new Set(current.keys);
            for (const row of this.rows()) {
                // all: the keys are the rows left out; else the rows chosen
                if (chosen.has(row.id) !== current.all) {
                    keys.add(row.id);
                } else keys.delete(row.id);
            }
            return { all: current.all, keys };
        });
    }
}
