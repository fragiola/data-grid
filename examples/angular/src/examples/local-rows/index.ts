import { ChangeDetectionStrategy, Component, computed } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
} from "@fragiola/data-grid-angular";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import {
    LucideChevronLeft,
    LucideChevronRight,
    LucideChevronsLeft,
    LucideChevronsRight,
    LucideSearch,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { FIELDS } from "#/components/atoms/fields";
import { CHECKBOX } from "#/components/ui/checkbox";
import { SELECT_PARTS } from "#/components/ui/select";
import { formatMoney, formatNumber, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const all = people(1_000);

const TEAMS = [...new Set(all.map((person) => person.team))].sort();

/** The salary filter's choices: a minimum, or none. */
const SALARIES: Record<string, string> = {
    any: "Any salary",
    "60000": "From $60k",
    "90000": "From $90k",
    "120000": "From $120k",
};

const PAGE_SIZES: Record<string, string> = {
    "25": "25 a page",
    "50": "50 a page",
    "100": "100 a page",
};

/** A select's options, in their order. */
const itemsOf = (labels: Record<string, string>) =>
    Object.entries(labels).map(([value, label]) => ({ value, label }));

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
        // its own filter: a minimum, not an equal value
        filter: (value, minimum) =>
            typeof value === "number" &&
            typeof minimum === "number" &&
            value >= minimum,
    },
    { key: "joined", name: "Joined", width: 130, sortable: true },
];

@Component({
    selector: "example-local-rows",
    imports: [
        DATA_GRID,
        DataGridLocalRows,
        ClickableButton,
        FIELDS,
        CHECKBOX,
        SELECT_PARTS,
        LucideChevronLeft,
        LucideChevronRight,
        LucideChevronsLeft,
        LucideChevronsRight,
        LucideSearch,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <div [class]="styles.toolbarRow">
                    <div [class]="styles.search">
                        <kit-input-simple
                            ariaLabel="Search every column"
                            placeholder="Search"
                            [value]="local.filter.search"
                            (valueChange)="local.filter.setSearch($event)"
                        >
                            <svg kitInset="start" lucideSearch aria-hidden="true" [class]="styles.icon"></svg>
                        </kit-input-simple>
                    </div>
                    <div [class]="styles.nameFilter">
                        <kit-input-simple
                            ariaLabel="Name contains"
                            placeholder="Name contains"
                            [value]="name()"
                            (valueChange)="local.filter.set('name', $event)"
                        />
                    </div>
                    <button
                        [kitSelectTrigger]="salaryList"
                        [items]="SALARIES"
                        [value]="salary()"
                        (valueChange)="setSalary($event)"
                        aria-label="Salary"
                        [class]="styles.select"
                    >
                        <span kitSelectValue></span>
                    </button>
                    <ng-template #salaryList>
                        <div kitSelectContent>
                            @for (item of SALARY_ITEMS; track item.value) {
                                <div [kitSelectItem]="item.value">{{ item.label }}</div>
                            }
                        </div>
                    </ng-template>
                </div>
                <div [class]="styles.toolbarRow">
                    <fieldset [class]="styles.teams">
                        <legend [class]="styles.teamsTitle">Teams</legend>
                        <!-- the checkbox is the control the label names -->
                        @for (team of TEAMS; track team) {
                            <label [class]="styles.team">
                                <button
                                    kitCheckbox
                                    [checked]="checkedTeams().includes(team)"
                                    (checkedChange)="toggleTeam(team)"
                                >
                                    <span kitCheckboxIndicator></span>
                                </button>
                                {{ team }}
                            </label>
                        }
                    </fieldset>
                    <button kitClickable size="sm" variant="ghost" (click)="clear()">
                        Clear filters
                    </button>
                    <span [class]="styles.count" data-testid="count">
                        {{ formatNumber(local.filteredCount) }} of
                        {{ formatNumber(local.total) }} people
                    </span>
                </div>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [dataGridLocalRows]="local"
                [columns]="columns"
                [rowKey]="rowKey"
                [rowHeight]="36"
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
                        No one matches these filters.
                    </div>
                </div>
            </div>
            <nav [class]="styles.pager" aria-label="Pages">
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    aria-label="First page"
                    [disabled]="!local.page.canPrevious"
                    (click)="local.page.first()"
                >
                    <svg lucideChevronsLeft aria-hidden="true"></svg>
                </button>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    aria-label="Previous page"
                    [disabled]="!local.page.canPrevious"
                    (click)="local.page.previous()"
                >
                    <svg lucideChevronLeft aria-hidden="true"></svg>
                </button>
                <span [class]="styles.pageOf" data-testid="page">
                    Page {{ local.page.index + 1 }} of {{ local.page.count }}
                </span>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    aria-label="Next page"
                    [disabled]="!local.page.canNext"
                    (click)="local.page.next()"
                >
                    <svg lucideChevronRight aria-hidden="true"></svg>
                </button>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    aria-label="Last page"
                    [disabled]="!local.page.canNext"
                    (click)="local.page.last()"
                >
                    <svg lucideChevronsRight aria-hidden="true"></svg>
                </button>
                <button
                    [kitSelectTrigger]="pageSizeList"
                    [items]="PAGE_SIZES"
                    [value]="pageSize()"
                    (valueChange)="setPageSize($event)"
                    aria-label="Rows per page"
                    [class]="styles.select"
                >
                    <span kitSelectValue></span>
                </button>
                <ng-template #pageSizeList>
                    <div kitSelectContent>
                        @for (item of PAGE_SIZE_ITEMS; track item.value) {
                            <div [kitSelectItem]="item.value">{{ item.label }}</div>
                        }
                    </div>
                </ng-template>
            </nav>
        </div>
    `,
})
export default class LocalRows {
    protected readonly styles = styles;
    protected readonly TEAMS = TEAMS;
    protected readonly SALARIES = SALARIES;
    protected readonly SALARY_ITEMS = itemsOf(SALARIES);
    protected readonly PAGE_SIZES = PAGE_SIZES;
    protected readonly PAGE_SIZE_ITEMS = itemsOf(PAGE_SIZES);
    protected readonly formatNumber = formatNumber;

    readonly columns = columns;

    // every row is in memory: one injection function filters, searches, sorts and pages them, and
    // keeps that state itself. Given to the root, it hands the grid its rows and its sort; its
    // controls go to the toolbar and the pager
    // sorting is a feature the grid installs: the local rows' sort needs it, or no column sorts
    readonly features = [sorting()];
    readonly local = injectLocalRows(all, columns, {
        pageSize: 25,
        defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
    });

    protected readonly checkedTeams = computed((): readonly unknown[] => {
        const teams = this.local.filter.values.team;
        return Array.isArray(teams) ? teams : [];
    });

    protected readonly name = computed(() => {
        const name = this.local.filter.values.name;
        return typeof name === "string" ? name : "";
    });

    protected readonly salary = computed(() => {
        const minimum = this.local.filter.values.salary;
        return typeof minimum === "number" ? String(minimum) : "any";
    });

    protected readonly pageSize = computed(() => String(this.local.page.size));

    readonly rowKey = (row: Person) => row.id;

    protected toggleTeam(team: string) {
        const checked = this.checkedTeams();
        this.local.filter.set(
            "team",
            checked.includes(team)
                ? checked.filter((other) => other !== team)
                : [...checked, team],
        );
    }

    protected setSalary(choice: unknown) {
        this.local.filter.set(
            "salary",
            choice === "any" || choice === null ? undefined : Number(choice),
        );
    }

    protected setPageSize(size: unknown) {
        // a cleared choice keeps the page size
        if (typeof size === "string") this.local.page.setSize(Number(size));
    }

    protected clear() {
        this.local.filter.clear();
        this.local.filter.setSearch("");
    }
}
