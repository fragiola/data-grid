import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import {
    type Column,
    DATA_GRID,
    type DataGridNode,
    type RowKey,
} from "@fragiola/data-grid-angular";
import {
    DataGridLocalRows,
    groupKeyOf,
    injectLocalRows,
} from "@fragiola/data-grid-angular/local";
import { navigation } from "@fragiola/data-grid-angular/navigation";
import {
    DataGridRowSelection,
    rowSelection,
} from "@fragiola/data-grid-angular/row-selection";
import { sorting } from "@fragiola/data-grid-angular/sorting";
import { LucideSearch } from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { FIELDS } from "#/components/atoms/fields";
import { SELECT_PARTS } from "#/components/ui/select";
import { formatMoney, formatNumber, type Person, people } from "../_kit/data";
import { GroupLabel } from "./group-label";
import { AGGREGATES, GROUP_BY, GROUPINGS, type Grouping } from "./grouping";
import { SelectGroup } from "./select-group";
import { SelectRow } from "./select-row";
import * as styles from "./styles";

// The rows in memory searched, sorted and grouped by one injection function (`[dataGridLocalRows]`
// on the root); it keeps the expanded groups. A cell shows more than its default in two columns:
// the checkboxes (`select-row.ts`, `select-group.ts`) and the name, a group's label with its
// toggle (`group-label.ts`) or a person's name indented under its group.

const ROWS = people(500);

/** A person's key: what the selection holds, and what selecting a group selects. */
const rowKey = (person: Person) => person.id;

/**
 * Who joined before 2012 is archived: never selected, by a checkbox, a group's, a range or "every
 * row" (the grid asks the rows it has; a group's keys leave them out, collapsed or not).
 */
const isSelectable = (person: Person) => person.joined >= "2012";

@Component({
    selector: "example-row-grouping",
    imports: [
        DATA_GRID,
        DataGridLocalRows,
        ClickableButton,
        FIELDS,
        SELECT_PARTS,
        LucideSearch,
        GroupLabel,
        SelectGroup,
        SelectRow,
        DataGridRowSelection,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="styles.frame">
            <div [class]="styles.toolbar">
                <button
                    [kitSelectTrigger]="groupingList"
                    [items]="GROUPINGS"
                    [value]="grouping()"
                    (valueChange)="setGrouping($event)"
                    aria-label="Group rows"
                    [class]="styles.select"
                >
                    <span kitSelectValue></span>
                </button>
                <ng-template #groupingList>
                    <div kitSelectContent>
                        @for (choice of groupings; track choice[0]) {
                            <div [kitSelectItem]="choice[0]">{{ choice[1] }}</div>
                        }
                    </div>
                </ng-template>
                <kit-input-simple
                    ariaLabel="Search every column"
                    placeholder="Search"
                    [value]="local.filter.search"
                    (valueChange)="local.filter.setSearch($event)"
                    [class]="styles.search"
                >
                    <svg kitInset="start" lucideSearch aria-hidden="true" [class]="styles.icon"></svg>
                </kit-input-simple>
                <button kitClickable size="sm" variant="ghost" (click)="local.group.expandAll()">
                    Expand all
                </button>
                <button kitClickable size="sm" variant="ghost" (click)="local.group.collapseAll()">
                    Collapse all
                </button>
                <span [class]="styles.count" data-testid="selected-count">
                    {{ formatNumber(selected().length) }} selected ·
                    {{ formatNumber(local.filteredCount) }} people
                </span>
            </div>
            <div
                dataGridRoot
                [features]="features"
                [dataGridLocalRows]="local"
                [columns]="columns"
                [rowHeight]="38"
                dataGridRowSelection
                rowSelection="multiple"
                [isRowSelectable]="isSelectable"
                [selectedRowKeys]="selected()"
                (selectedRowKeysChange)="selected.set($event)"
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
                            <div
                                [dataGridRow]="row"
                                [class]="styles.row(row, row.row !== undefined && !isSelectable(row.row))"
                            >
                                <ng-template [dataGridCells]="columns" let-cell>
                                    <!-- what a cell shows beyond its default: the checkboxes, a group's label, an indented name -->
                                    <div [dataGridCell]="cell" [class]="styles.cell">
                                        @switch (cell.column.key) {
                                            @case ("select") {
                                                @if (cell.group) {
                                                    <example-select-group
                                                        [rowIndex]="cell.rowIndex"
                                                        [group]="cell.group"
                                                    />
                                                } @else if (cell.row) {
                                                    <example-select-row
                                                        [rowIndex]="cell.rowIndex"
                                                        [name]="cell.row.name"
                                                    />
                                                }
                                            }
                                            @case ("name") {
                                                @if (cell.group) {
                                                    <example-group-label [cell]="cell" [group]="cell.group" />
                                                } @else {
                                                    <span [class]="styles.name(row.depth)">{{ cell.row?.name }}</span>
                                                }
                                            }
                                            @default {
                                                <ng-container *dataGridCellContent />
                                            }
                                        }
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
export default class RowGrouping {
    protected readonly styles = styles;
    protected readonly formatNumber = formatNumber;
    protected readonly GROUPINGS = GROUPINGS;
    protected readonly groupings = Object.entries(GROUPINGS);
    protected readonly isSelectable = isSelectable;

    readonly columns: Column<Person, DataGridNode>[] = [
        { key: "select", width: 44, pinned: "start" },
        {
            key: "name",
            name: "Name",
            width: 250,
            pinned: "start",
            sortable: true,
        },
        { key: "team", name: "Team", width: 120, sortable: true },
        { key: "city", name: "City", width: 130, sortable: true },
        {
            key: "salary",
            name: "Salary",
            width: 140,
            sortable: true,
            renderCell: ({ row }) => formatMoney(row.salary),
            // a group row's salary is its payroll, the aggregate
            renderGroupCell: ({ value }) =>
                typeof value === "number" ? formatMoney(value) : null,
        },
        { key: "joined", name: "Joined", width: 120, sortable: true },
        { key: "email", name: "Email", width: 260 },
    ];

    protected readonly grouping = signal<Grouping>("team");
    protected readonly selected = signal<readonly RowKey[]>([]);

    // the features the grid installs: sorting (the local rows' sort needs it, or no column sorts),
    // cell navigation (the keys, the active cell, the tab stop), row selection
    readonly features = [sorting(), navigation(), rowSelection()];
    readonly local = injectLocalRows(ROWS, this.columns, () => ({
        groupBy: GROUP_BY[this.grouping()],
        aggregates: AGGREGATES,
        rowKey,
        isRowSelectable: isSelectable,
        defaultSortColumns: [
            { columnKey: "name", direction: "ascending" as const },
        ],
        defaultExpandedGroupKeys: [groupKeyOf([["team", "Design"]])],
    }));

    protected setGrouping(choice: unknown) {
        if (choice === "team" || choice === "team-city") {
            this.grouping.set(choice);
        }
    }
}
