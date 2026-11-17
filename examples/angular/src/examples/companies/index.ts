import {
    ChangeDetectionStrategy,
    Component,
    computed,
    signal,
    type TemplateRef,
    ViewChild,
} from "@angular/core";
import {
    type CellTemplateProps,
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridNode,
    type HeaderCellRenderProps,
    type RowKey,
    type TemplateContext,
    templateContent,
} from "@fragiola/data-grid-angular";
import {
    DataGridLocalRows,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import {
    DataGridRowSelection,
    rowSelection,
} from "@fragiola/data-grid-angular/row-selection";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import {
    LucideAtSign,
    LucideBuilding2,
    LucideDollarSign,
    LucideFileText,
    LucideGlobe,
    LucideMapPin,
    LucideTags,
    LucideTrash2,
    LucideUsers,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { AVATAR } from "#/components/ui/avatar";
import { SELECT_PARTS } from "#/components/ui/select";
import {
    ARR_RANGES,
    type Company,
    companies,
    EMPLOYEE_RANGES,
    initials,
} from "../_kit/companies";
import { hash } from "../_kit/data";
import { SelectAllHeader } from "./select-all-header";
import { SelectCell } from "./select-cell";
import { SortLabel } from "./sort-label";
import { isSortKey, type SortKey } from "./state";
import * as styles from "./styles";

const SORT_LABELS: Record<SortKey, string> = {
    name: "Company",
    domain: "Domain",
    employees: "Employee range",
    arr: "Estimated ARR",
    country: "Primary location",
};

const SORT_ITEMS = Object.entries(SORT_LABELS).map(([value, label]) => ({
    value,
    label,
}));

/** A range's place in its scale; not estimated (no range) sorts first. */
function rank(
    ranges: readonly string[],
    range: string | null | undefined,
): number {
    return range ? ranges.indexOf(range) : -1;
}

type CompanyCell = TemplateRef<TemplateContext<CellTemplateProps<Company>>>;
type CompanyHeader = TemplateRef<
    TemplateContext<HeaderCellRenderProps<Company, DataGridNode>>
>;

@Component({
    selector: "example-companies",
    imports: [
        DATA_GRID,
        DataGridLocalRows,
        ClickableButton,
        AVATAR,
        SELECT_PARTS,
        SelectAllHeader,
        SelectCell,
        SortLabel,
        LucideAtSign,
        LucideBuilding2,
        LucideDollarSign,
        LucideFileText,
        LucideGlobe,
        LucideMapPin,
        LucideTags,
        LucideTrash2,
        LucideUsers,
        DataGridRowSelection,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <button
                    [kitSelectTrigger]="sortList"
                    [items]="SORT_LABELS"
                    [value]="local.sort.columns[0]?.columnKey ?? null"
                    (valueChange)="sortBy($event)"
                    aria-label="Sorted by"
                    [class]="styles.sortSelect"
                >
                    <span [class]="styles.sortLabel">Sorted by</span>
                    <span kitSelectValue></span>
                </button>
                <ng-template #sortList>
                    <div kitSelectContent>
                        @for (item of SORT_ITEMS; track item.value) {
                            <div [kitSelectItem]="item.value">{{ item.label }}</div>
                        }
                    </div>
                </ng-template>
                <button
                    kitClickable
                    size="sm"
                    variant="outline"
                    [disabled]="selected().length === 0"
                    (click)="deleteSelected()"
                >
                    <svg lucideTrash2 aria-hidden="true"></svg>
                    Delete selected
                </button>
                <span [class]="styles.count" data-testid="selected-count">
                    {{ selected().length }} selected · {{ local.rows.length }} companies
                </span>
            </div>
            <div
                dataGridRoot
                [columns]="columns"
                [rowKey]="rowKey"
                [rowHeight]="44"
                [headerRowHeight]="40"
                dataGridRowSelection
                rowSelection="multiple"
                [(selectedRowKeys)]="selected"
                [features]="features"
                [dataGridLocalRows]="local"
                [class]="styles.root"
            >
                <ng-template #selectAllHeader [dataGridTemplate]="headerContext">
                    <example-select-all-header [rowKeys]="ids()" />
                </ng-template>
                <ng-template #selectCell [dataGridTemplate]="cellContext" let-row="row" let-rowIndex="rowIndex">
                    <example-select-cell [rowIndex]="rowIndex" [name]="row.name" />
                </ng-template>
                <ng-template #companyHeader [dataGridTemplate]="headerContext">
                    <span exampleSortLabel columnKey="name">
                        <svg lucideBuilding2 aria-hidden="true" [class]="styles.icon"></svg>
                        Company
                    </span>
                </ng-template>
                <ng-template #companyCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.company">
                        <span kitAvatar [class]="styles.logo">
                            <span kitAvatarFallback [class]="styles.logoTone(tone(row.id))">
                                {{ initials(row.name) }}
                            </span>
                        </span>
                        <span [class]="styles.truncate">{{ row.name }}</span>
                    </span>
                </ng-template>
                <ng-template #domainHeader [dataGridTemplate]="headerContext">
                    <span exampleSortLabel columnKey="domain">
                        <svg lucideGlobe aria-hidden="true" [class]="styles.icon"></svg>
                        Domain
                    </span>
                </ng-template>
                <ng-template #domainCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.outlineChip">{{ row.domain }}</span>
                </ng-template>
                <ng-template #categoriesHeader [dataGridTemplate]="headerContext">
                    <span [class]="styles.headerLabel">
                        <svg lucideTags aria-hidden="true" [class]="styles.icon"></svg>
                        Categories
                    </span>
                </ng-template>
                <ng-template #categoriesCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.chips">
                        @for (category of row.categories; track category) {
                            <span [class]="styles.categoryChip(category)">{{ category }}</span>
                        }
                    </span>
                </ng-template>
                <ng-template #descriptionHeader [dataGridTemplate]="headerContext">
                    <span [class]="styles.headerLabel">
                        <svg lucideFileText aria-hidden="true" [class]="styles.icon"></svg>
                        Description
                    </span>
                </ng-template>
                <ng-template #descriptionCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.truncate" [title]="row.description">{{ row.description }}</span>
                </ng-template>
                <ng-template #linkedinHeader [dataGridTemplate]="headerContext">
                    <span [class]="styles.headerLabel">
                        <svg lucideAtSign aria-hidden="true" [class]="styles.icon"></svg>
                        LinkedIn
                    </span>
                </ng-template>
                <ng-template #linkedinCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.outlineChip">{{ row.linkedin }}</span>
                </ng-template>
                <ng-template #employeesHeader [dataGridTemplate]="headerContext">
                    <span exampleSortLabel columnKey="employees">
                        <svg lucideUsers aria-hidden="true" [class]="styles.icon"></svg>
                        Employees
                    </span>
                </ng-template>
                <ng-template #employeesCell [dataGridTemplate]="cellContext" let-row="row">
                    <span [class]="styles.rangeBadge(EMPLOYEE_RANGES.indexOf(row.employees))">
                        {{ row.employees }}
                    </span>
                </ng-template>
                <ng-template #arrHeader [dataGridTemplate]="headerContext">
                    <span exampleSortLabel columnKey="arr">
                        <svg lucideDollarSign aria-hidden="true" [class]="styles.icon"></svg>
                        Estimated ARR
                    </span>
                </ng-template>
                <ng-template #arrCell [dataGridTemplate]="cellContext" let-row="row">
                    @if (row.arr) {
                        <span [class]="styles.arrBadge(ARR_RANGES.indexOf(row.arr))">{{ row.arr }}</span>
                    }
                </ng-template>
                <ng-template #countryHeader [dataGridTemplate]="headerContext">
                    <span exampleSortLabel columnKey="country">
                        <svg lucideMapPin aria-hidden="true" [class]="styles.icon"></svg>
                        Primary location
                    </span>
                </ng-template>
                <ng-template #countryCell [dataGridTemplate]="cellContext" let-row="row">
                    <!-- a link out of a cell -->
                    <a [class]="styles.link" [href]="wikipedia(row.country)" target="_blank" rel="noreferrer">
                        {{ row.country }}
                    </a>
                </ng-template>
                <div dataGridGrid aria-label="Companies" [class]="styles.grid">
                    <div *dataGridHeader [class]="styles.header">
                        <div dataGridHeaderRow [class]="styles.headerRow">
                            <ng-template [dataGridHeaderCells]="columns" let-cell>
                                <div [dataGridHeaderCell]="cell" [class]="styles.headerCell">
                                    <ng-container *dataGridCellContent />
                                    <!--
                                        A resizable column's handle, at its header cell's right edge: the grid
                                        drags it, moves it with the arrows (F2 on the header reaches it) and
                                        fits it to its content on a double click. None elsewhere. The
                                        directive's props make it a separator, a focusable one (the APG's
                                        splitter), which an <hr> cannot be.
                                    -->
                                    <div
                                        *dataGridColumnResizer="cell"
                                        [attr.aria-label]="'Resize ' + (cell.column?.name ?? cell.key)"
                                        [class]="styles.resizer"
                                    ></div>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                    <div dataGridBody>
                        <ng-template [dataGridRows]="columns" let-row>
                            <div
                                [dataGridRow]="row"
                                #part="dataGridRow"
                                [class]="styles.row(part.state()?.selected === true)"
                            >
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
export default class Companies {
    protected readonly styles = styles;
    protected readonly SORT_LABELS = SORT_LABELS;
    protected readonly SORT_ITEMS = SORT_ITEMS;
    protected readonly EMPLOYEE_RANGES: readonly string[] = EMPLOYEE_RANGES;
    protected readonly ARR_RANGES: readonly string[] = ARR_RANGES;
    protected readonly initials = initials;
    protected readonly cellContext = contextOf<CellTemplateProps<Company>>();
    protected readonly headerContext =
        contextOf<HeaderCellRenderProps<Company, DataGridNode>>();

    @ViewChild("selectAllHeader", { static: true })
    private readonly selectAllHeader!: CompanyHeader;
    @ViewChild("selectCell", { static: true })
    private readonly selectCell!: CompanyCell;
    @ViewChild("companyHeader", { static: true })
    private readonly companyHeader!: CompanyHeader;
    @ViewChild("companyCell", { static: true })
    private readonly companyCell!: CompanyCell;
    @ViewChild("domainHeader", { static: true })
    private readonly domainHeader!: CompanyHeader;
    @ViewChild("domainCell", { static: true })
    private readonly domainCell!: CompanyCell;
    @ViewChild("categoriesHeader", { static: true })
    private readonly categoriesHeader!: CompanyHeader;
    @ViewChild("categoriesCell", { static: true })
    private readonly categoriesCell!: CompanyCell;
    @ViewChild("descriptionHeader", { static: true })
    private readonly descriptionHeader!: CompanyHeader;
    @ViewChild("descriptionCell", { static: true })
    private readonly descriptionCell!: CompanyCell;
    @ViewChild("linkedinHeader", { static: true })
    private readonly linkedinHeader!: CompanyHeader;
    @ViewChild("linkedinCell", { static: true })
    private readonly linkedinCell!: CompanyCell;
    @ViewChild("employeesHeader", { static: true })
    private readonly employeesHeader!: CompanyHeader;
    @ViewChild("employeesCell", { static: true })
    private readonly employeesCell!: CompanyCell;
    @ViewChild("arrHeader", { static: true })
    private readonly arrHeader!: CompanyHeader;
    @ViewChild("arrCell", { static: true })
    private readonly arrCell!: CompanyCell;
    @ViewChild("countryHeader", { static: true })
    private readonly countryHeader!: CompanyHeader;
    @ViewChild("countryCell", { static: true })
    private readonly countryCell!: CompanyCell;

    // Every column but the checkboxes resizes (a handle in its header cell) and moves (its header
    // cell dragged, or Ctrl/⌘+Shift+←/→ on it); its `name` is the handle's, the header showing its
    // own label.
    readonly columns: Column<Company, DataGridNode>[] = [
        {
            key: "select",
            width: 48,
            renderHeaderCell: (props) =>
                templateContent(this.selectAllHeader, props),
            renderCell: (props) => templateContent(this.selectCell, props),
        },
        {
            key: "name",
            name: "Company",
            width: 220,
            resizable: true,
            reorderable: true,
            sortable: true,
            renderHeaderCell: (props) =>
                templateContent(this.companyHeader, props),
            renderCell: (props) => templateContent(this.companyCell, props),
        },
        {
            key: "domain",
            name: "Domain",
            width: 170,
            resizable: true,
            reorderable: true,
            sortable: true,
            renderHeaderCell: (props) =>
                templateContent(this.domainHeader, props),
            renderCell: (props) => templateContent(this.domainCell, props),
        },
        {
            key: "categories",
            name: "Categories",
            width: 360,
            resizable: true,
            reorderable: true,
            renderHeaderCell: (props) =>
                templateContent(this.categoriesHeader, props),
            renderCell: (props) => templateContent(this.categoriesCell, props),
        },
        {
            key: "description",
            name: "Description",
            width: 300,
            resizable: true,
            reorderable: true,
            renderHeaderCell: (props) =>
                templateContent(this.descriptionHeader, props),
            renderCell: (props) => templateContent(this.descriptionCell, props),
        },
        {
            key: "linkedin",
            name: "LinkedIn",
            width: 170,
            resizable: true,
            reorderable: true,
            renderHeaderCell: (props) =>
                templateContent(this.linkedinHeader, props),
            renderCell: (props) => templateContent(this.linkedinCell, props),
        },
        {
            key: "employees",
            name: "Employees",
            width: 150,
            resizable: true,
            reorderable: true,
            sortable: true,
            // ranges sort by their scale, not as text
            compare: (a, b) =>
                rank(EMPLOYEE_RANGES, a.employees) -
                rank(EMPLOYEE_RANGES, b.employees),
            renderHeaderCell: (props) =>
                templateContent(this.employeesHeader, props),
            renderCell: (props) => templateContent(this.employeesCell, props),
        },
        {
            key: "arr",
            name: "Estimated ARR",
            width: 160,
            resizable: true,
            reorderable: true,
            sortable: true,
            compare: (a, b) =>
                rank(ARR_RANGES, a.arr) - rank(ARR_RANGES, b.arr),
            renderHeaderCell: (props) => templateContent(this.arrHeader, props),
            renderCell: (props) => templateContent(this.arrCell, props),
        },
        {
            key: "country",
            name: "Primary location",
            width: 210,
            resizable: true,
            reorderable: true,
            sortable: true,
            renderHeaderCell: (props) =>
                templateContent(this.countryHeader, props),
            renderCell: (props) => templateContent(this.countryCell, props),
        },
    ];

    private readonly all = signal(companies(500));
    // the grid selects (checkboxes, Shift+Space, Ctrl+A); the app keeps the keys to act on them
    readonly selected = signal<readonly RowKey[]>([]);
    // the rows in memory sorted by one injection function: the header and the toolbar's select
    // both set its sort (the first column first, the next ones breaking ties)
    // the features the grid installs: sorting (the local rows' sort needs it, or no column sorts),
    // cell navigation (the keys, the active cell, the tab stop), row selection
    readonly features = [sorting(), navigation(), rowSelection()];
    readonly local = injectLocalRows(this.all, this.columns, {
        defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
    });
    /** The ids of the companies the grid holds: what the header's checkbox selects. */
    protected readonly ids = computed(() =>
        this.local.rows.map((row) => row.id),
    );

    readonly rowKey = (row: Company) => row.id;

    /** A logo's tone, picked by the company. */
    protected tone(id: number): number {
        return hash(id, 6);
    }

    protected wikipedia(country: string): string {
        return `https://en.wikipedia.org/wiki/${encodeURIComponent(country)}`;
    }

    protected sortBy(key: unknown) {
        if (isSortKey(key)) {
            this.local.sort.set([{ columnKey: key, direction: "ascending" }]);
        }
    }

    protected deleteSelected() {
        const gone = new Set(this.selected());
        this.all.update((current) =>
            current.filter((row) => !gone.has(row.id)),
        );
        this.selected.set([]);
    }
}
