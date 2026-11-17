import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    signal,
    untracked,
} from "@angular/core";
import { pageCount } from "@fragiola/data-grid/local";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";
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
import { RequestLog } from "./request-log";
import { fetchPeople } from "./server";
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
    // the features the grid installs: sorting (the header toggles the sort the app keeps), cell
    // navigation (the keys, the active cell, the tab stop)
    readonly features = [sorting(), navigation()];

    // the external mode: the app keeps the sort (grid state, the header toggles it), the filter,
    // the search and the page, and asks the server; the grid shows the page it gets back
    readonly sortColumns = signal<readonly SortColumn[]>([
        { columnKey: "name", direction: "ascending" },
    ]);
    readonly team = signal("");
    readonly typed = signal("");
    readonly search = signal("");
    readonly pageIndex = signal(0);
    readonly page = signal<{ rows: readonly Person[]; total: number }>({
        rows: [],
        total: 0,
    });
    readonly loading = signal(true);

    protected readonly pages = computed(() =>
        pageCount(this.page().total, PAGE_SIZE),
    );

    readonly rowKey = (row: Person) => row.id;

    constructor() {
        // the search goes to the server once the typing pauses (and only when it changed: a page
        // chosen meanwhile stays)
        effect((onCleanup) => {
            const text = this.typed();
            if (text === this.search()) return;
            const timer = setTimeout(() => {
                this.search.set(text);
                this.pageIndex.set(0);
            }, 250);
            onCleanup(() => clearTimeout(timer));
        });

        effect((onCleanup) => {
            const query = {
                sortColumns: this.sortColumns(),
                team: this.team(),
                search: this.search(),
                pageIndex: this.pageIndex(),
                pageSize: PAGE_SIZE,
            };
            // an answer to a query the app has moved on from is dropped
            let current = true;
            untracked(() => this.loading.set(true));
            fetchPeople(query).then((answer) => {
                if (!current) return;
                this.page.set(answer);
                this.loading.set(false);
            });
            onCleanup(() => {
                current = false;
            });
        });
    }

    protected chooseTeam(choice: unknown) {
        this.team.set(
            typeof choice === "string" && choice !== "any" ? choice : "",
        );
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
