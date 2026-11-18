import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    signal,
} from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import {
    type ColumnFilters,
    DataGridFiltering,
    filtering,
} from "@fragiola/data-grid-angular/filtering";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import {
    DataGridPagination,
    pageCount,
    pagination,
} from "@fragiola/data-grid-angular/pagination";
import { DataGridSearch, search } from "@fragiola/data-grid-angular/search";
import {
    DataGridSorting,
    type SortColumn,
    sorting,
} from "@fragiola/data-grid-angular/sorting";
import {
    LucideChevronLeft,
    LucideChevronRight,
    LucideSearch,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { FIELDS } from "#/components/atoms/fields";
import { SELECT_PARTS } from "#/components/ui/select";
import { formatMoney, formatNumber, type Person } from "../_kit/data";
import { fetchPeople } from "../_kit/people-server";
import { createServerQuery } from "../_kit/server-query";
import { RequestLog } from "./request-log";
import * as styles from "./styles";

const PAGE_SIZE = 50;

const TEAMS: Record<string, string> = {
    any: "Every team",
    Platform: "Platform",
    Design: "Design",
    Data: "Data",
    Mobile: "Mobile",
    Growth: "Growth",
    Security: "Security",
};

const TEAM_ITEMS = Object.entries(TEAMS).map(([value, label]) => ({
    value,
    label,
}));

const columns: Column<Person, DataGridNode>[] = [
    { key: "name", name: "Name", width: 180, sortable: true },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140, sortable: true },
    { key: "team", name: "Team", width: 130, sortable: true },
    {
        key: "salary",
        name: "Salary",
        width: 130,
        sortable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

@Component({
    selector: "example-server-side",
    imports: [
        DATA_GRID,
        DataGridSorting,
        DataGridFiltering,
        DataGridSearch,
        DataGridPagination,
        ClickableButton,
        FIELDS,
        SELECT_PARTS,
        RequestLog,
        LucideChevronLeft,
        LucideChevronRight,
        LucideSearch,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <kit-input-simple
                    ariaLabel="Search every column"
                    placeholder="Search"
                    [value]="typed()"
                    (valueChange)="typed.set($event)"
                    [class]="styles.search"
                >
                    <svg kitInset="start" lucideSearch aria-hidden="true" [class]="styles.icon"></svg>
                </kit-input-simple>
                <button
                    [kitSelectTrigger]="teamList"
                    [items]="TEAMS"
                    [value]="team() || 'any'"
                    (valueChange)="chooseTeam($event)"
                    aria-label="Team"
                    [class]="styles.select"
                >
                    <span kitSelectValue></span>
                </button>
                <ng-template #teamList>
                    <div kitSelectContent>
                        @for (item of TEAM_ITEMS; track item.value) {
                            <div [kitSelectItem]="item.value">{{ item.label }}</div>
                        }
                    </div>
                </ng-template>
                <span [class]="styles.count" data-testid="count" aria-live="polite">
                    {{ loading() ? "Loading…" : formatNumber(page().total) + " people" }}
                </span>
            </div>
            <div [class]="styles.layout">
                <div
                    dataGridRoot
                    [columns]="columns"
                    [rows]="page().rows"
                    [rowKey]="rowKey"
                    [rowHeight]="36"
                    [features]="features"
                    dataGridSorting
                    [sortColumns]="sortColumns()"
                    (sortColumnsChange)="sortBy($event)"
                    dataGridFiltering
                    [columnFilters]="columnFilters()"
                    (columnFiltersChange)="filterBy($event)"
                    dataGridSearch
                    [searchText]="searchText()"
                    (searchTextChange)="searchFor($event)"
                    dataGridPagination
                    [pageIndex]="pageIndex()"
                    (pageIndexChange)="pageIndex.set($event)"
                    [pageSize]="PAGE_SIZE"
                    [totalRowCount]="page().total"
                    [attr.aria-busy]="loading() || null"
                    [class]="styles.root"
                >
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
                        <div dataGridBody [class]="styles.body(loading())">
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
                <example-request-log />
            </div>
            <nav [class]="styles.pager" aria-label="Pages">
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    aria-label="Previous page"
                    [disabled]="pageIndex() === 0"
                    (click)="previous()"
                >
                    <svg lucideChevronLeft aria-hidden="true"></svg>
                </button>
                <span [class]="styles.pageOf" data-testid="page">
                    Page {{ pageIndex() + 1 }} of {{ pages() }}
                </span>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    aria-label="Next page"
                    [disabled]="pageIndex() >= pages() - 1"
                    (click)="next()"
                >
                    <svg lucideChevronRight aria-hidden="true"></svg>
                </button>
            </nav>
        </div>
    `,
})
export default class ServerSide {
    protected readonly styles = styles;
    protected readonly TEAMS = TEAMS;
    protected readonly TEAM_ITEMS = TEAM_ITEMS;
    protected readonly formatNumber = formatNumber;

    readonly columns = columns;
    protected readonly PAGE_SIZE = PAGE_SIZE;
    // the features the grid installs: sorting (the header toggles the sort), filtering, search and
    // pagination (the column filters, the search text and the page, held by the grid's model: the
    // app reads them to ask the server, no rows in memory), cell navigation (the keys, the active
    // cell, the tab stop)
    readonly features = [
        sorting(),
        filtering(),
        search(),
        pagination(),
        navigation(),
    ];

    // the external mode: the grid's features hold the sort (the header toggles it), the column
    // filters, the search text and the page, controlled here; the app asks the server for the
    // page they make (the fetch policy in `_kit/server-query.ts`) and the grid shows it
    readonly sortColumns = signal<readonly SortColumn[]>([
        { columnKey: "name", direction: "ascending" },
    ]);
    readonly columnFilters = signal<ColumnFilters>({});
    readonly typed = signal("");
    readonly searchText = signal("");
    readonly pageIndex = signal(0);
    private readonly query = createServerQuery(fetchPeople);
    private readonly answer = signal(this.query.state);
    readonly page = computed(
        () => this.answer().answer ?? { rows: [], total: 0 },
    );
    readonly loading = computed(() => this.answer().loading);
    /** the team a filter holds: a list of one, the team chosen from the select */
    readonly team = computed(() => {
        const { team } = this.columnFilters() as { readonly team?: unknown };
        return Array.isArray(team) && typeof team[0] === "string"
            ? team[0]
            : "";
    });

    protected readonly pages = computed(() =>
        pageCount(this.page().total, PAGE_SIZE),
    );

    readonly rowKey = (row: Person) => row.id;

    constructor() {
        inject(DestroyRef).onDestroy(
            this.query.subscribe(() => this.answer.set(this.query.state)),
        );
        // the search goes to the server once the typing pauses (and only when it changed: a page
        // chosen meanwhile stays)
        effect((onCleanup) => {
            const text = this.typed();
            if (text === this.searchText()) return;
            const timer = setTimeout(() => {
                this.searchText.set(text);
                this.pageIndex.set(0);
            }, 250);
            onCleanup(() => clearTimeout(timer));
        });

        effect(() => {
            this.query.ask({
                sortColumns: this.sortColumns(),
                columnFilters: this.columnFilters(),
                searchText: this.searchText(),
                pageIndex: this.pageIndex(),
                pageSize: PAGE_SIZE,
            });
        });
    }

    protected chooseTeam(choice: unknown) {
        // a team chosen from a list: an exact value (a list filter), not a text
        this.columnFilters.set(
            typeof choice === "string" && choice !== "any"
                ? { team: [choice] }
                : {},
        );
        this.pageIndex.set(0);
    }

    protected filterBy(next: ColumnFilters) {
        this.columnFilters.set(next);
        this.pageIndex.set(0);
    }

    protected searchFor(next: string) {
        this.typed.set(next);
        this.searchText.set(next);
        this.pageIndex.set(0);
    }

    protected sortBy(next: readonly SortColumn[]) {
        this.sortColumns.set(next);
        this.pageIndex.set(0);
    }

    protected previous() {
        this.pageIndex.update((index) => Math.max(0, index - 1));
    }

    protected next() {
        this.pageIndex.update((index) => Math.min(this.pages() - 1, index + 1));
    }
}
