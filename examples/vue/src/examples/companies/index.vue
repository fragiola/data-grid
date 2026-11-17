<script setup lang="ts">
import {
    type Column,
    type HeaderCellInfo,
    headerCellContent,
    type RowKey,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { rowSelection } from "@fragiola/data-grid-vue/row-selection";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import {
    AtSignIcon,
    Building2Icon,
    DollarSignIcon,
    FileTextIcon,
    GlobeIcon,
    MapPinIcon,
    TagsIcon,
    Trash2Icon,
    UsersIcon,
} from "@lucide/vue";
import {
    type Component,
    computed,
    type FunctionalComponent,
    h,
    provide,
    shallowRef,
    type VNodeChild,
} from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Avatar } from "#/components/ui/avatar";
import { Select } from "#/components/ui/select";
import {
    ARR_RANGES,
    type Company,
    companies,
    EMPLOYEE_RANGES,
    initials,
} from "../_kit/companies";
import { hash } from "../_kit/data";
import CellLink from "./cell-link.vue";
import Resizer from "./resizer.vue";
import SelectAllHeader from "./select-all-header.vue";
import SelectCell from "./select-cell.vue";
import SortLabel from "./sort-label.vue";
import { COMPANY_IDS, isSortKey, type SortKey } from "./state";
import * as styles from "./styles";

// the features the grid installs: sorting (without it, a sortable column never sorts), cell
// navigation (the keys, the active cell, the tab stop), row selection
const features = [sorting(), navigation(), rowSelection()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Company, typeof features>();

const SORT_LABELS: Record<SortKey, string> = {
    name: "Company",
    domain: "Domain",
    employees: "Employee range",
    arr: "Estimated ARR",
    country: "Primary location",
};

/** A range's place in its scale; not estimated (no range) sorts first. */
function rank(
    ranges: readonly string[],
    range: string | null | undefined,
): number {
    return range ? ranges.indexOf(range) : -1;
}

/** A column's icon, hidden from assistive technology: the header's name says it. */
const icon = (component: Component) =>
    h(component, { "aria-hidden": "true", class: styles.icon });

/** A sortable column's header: its icon and name, and the direction while sorted. */
const sortLabel = (columnKey: SortKey, label: string, component: Component) =>
    h(
        SortLabel,
        { columnKey },
        { icon: () => icon(component), default: () => label },
    );

/** A column's header that does not sort: its icon and name. */
const headerLabel = (label: string, component: Component) =>
    h("span", { class: styles.headerLabel }, [icon(component), label]);

// Every column but the checkboxes resizes (a handle in its header cell) and moves (its header cell
// dragged, or Ctrl/⌘+Shift+←/→ on it); its `name` is the handle's, the header showing its own
// label.
const columns: Column<Company, VNodeChild>[] = [
    {
        key: "select",
        width: 48,
        renderHeaderCell: () => h(SelectAllHeader),
        renderCell: ({ row, rowIndex }) =>
            h(SelectCell, { rowIndex, name: row.name }),
    },
    {
        key: "name",
        name: "Company",
        width: 220,
        resizable: true,
        reorderable: true,
        sortable: true,
        renderHeaderCell: () => sortLabel("name", "Company", Building2Icon),
        renderCell: ({ row }) =>
            h("span", { class: styles.company }, [
                h(
                    Avatar.Root,
                    { class: styles.logo },
                    {
                        default: () =>
                            h(
                                Avatar.Fallback,
                                { class: styles.logoTone(hash(row.id, 6)) },
                                { default: () => initials(row.name) },
                            ),
                    },
                ),
                h("span", { class: styles.truncate }, row.name),
            ]),
    },
    {
        key: "domain",
        name: "Domain",
        width: 170,
        resizable: true,
        reorderable: true,
        sortable: true,
        renderHeaderCell: () => sortLabel("domain", "Domain", GlobeIcon),
        renderCell: ({ row }) =>
            h("span", { class: styles.outlineChip }, row.domain),
    },
    {
        key: "categories",
        name: "Categories",
        width: 360,
        resizable: true,
        reorderable: true,
        renderHeaderCell: () => headerLabel("Categories", TagsIcon),
        renderCell: ({ row }) =>
            h(
                "span",
                { class: styles.chips },
                row.categories.map((category) =>
                    h(
                        "span",
                        { key: category, class: styles.categoryChip(category) },
                        category,
                    ),
                ),
            ),
    },
    {
        key: "description",
        name: "Description",
        width: 300,
        resizable: true,
        reorderable: true,
        renderHeaderCell: () => headerLabel("Description", FileTextIcon),
        renderCell: ({ row }) =>
            h(
                "span",
                { class: styles.truncate, title: row.description },
                row.description,
            ),
    },
    {
        key: "linkedin",
        name: "LinkedIn",
        width: 170,
        resizable: true,
        reorderable: true,
        renderHeaderCell: () => headerLabel("LinkedIn", AtSignIcon),
        renderCell: ({ row }) =>
            h("span", { class: styles.outlineChip }, row.linkedin),
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
        renderHeaderCell: () => sortLabel("employees", "Employees", UsersIcon),
        renderCell: ({ row }) =>
            h(
                "span",
                {
                    class: styles.rangeBadge(
                        EMPLOYEE_RANGES.indexOf(row.employees),
                    ),
                },
                row.employees,
            ),
    },
    {
        key: "arr",
        name: "Estimated ARR",
        width: 160,
        resizable: true,
        reorderable: true,
        sortable: true,
        compare: (a, b) => rank(ARR_RANGES, a.arr) - rank(ARR_RANGES, b.arr),
        renderHeaderCell: () =>
            sortLabel("arr", "Estimated ARR", DollarSignIcon),
        renderCell: ({ row }) =>
            row.arr
                ? h(
                      "span",
                      { class: styles.arrBadge(ARR_RANGES.indexOf(row.arr)) },
                      row.arr,
                  )
                : null,
    },
    {
        key: "country",
        name: "Primary location",
        width: 210,
        resizable: true,
        reorderable: true,
        sortable: true,
        renderHeaderCell: () =>
            sortLabel("country", "Primary location", MapPinIcon),
        renderCell: ({ row }) =>
            h(
                CellLink,
                {
                    href: `https://en.wikipedia.org/wiki/${encodeURIComponent(row.country)}`,
                },
                { default: () => row.country },
            ),
    },
];

/** A header cell's own content: its column's `renderHeaderCell`, else its name. */
const HeaderContent: FunctionalComponent<{ cell: HeaderCellInfo<Company> }> = (
    props,
) => headerCellContent(props.cell);

const all = shallowRef(companies(500));
// the grid selects (checkboxes, Shift+Space, Ctrl+A); the app keeps the keys to act on them
const selected = shallowRef<readonly RowKey[]>([]);
// the rows in memory sorted by one composable: the header and the toolbar's select both set its
// sort (the first column first, the next ones breaking ties)
const local = useLocalRows(() => all.value, columns, {
    defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
});
const ids = computed(() => local.rows.map((row) => row.id));
provide(COMPANY_IDS, ids);

function deleteSelected() {
    const gone = new Set(selected.value);
    all.value = all.value.filter((row) => !gone.has(row.id));
    selected.value = [];
}

function sortBy(key: unknown) {
    if (isSortKey(key)) {
        local.sort.set([{ columnKey: key, direction: "ascending" }]);
    }
}

// a row's tint: its key among the selected ones (Vue's parts have no state function for a class)
const selectedKeys = computed(() => new Set(selected.value));
const isSelected = (key: RowKey) => selectedKeys.value.has(key);

function setSelected(keys: readonly RowKey[]) {
    selected.value = keys;
}

const rowKey = (row: Company) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Select.Root
                :items="SORT_LABELS"
                :model-value="local.sort.columns[0]?.columnKey ?? null"
                @update:model-value="sortBy"
            >
                <Select.Trigger :class="styles.sortSelect" aria-label="Sorted by">
                    <span :class="styles.sortLabel">Sorted by</span>
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    <Select.Item
                        v-for="(label, key) in SORT_LABELS"
                        :key="key"
                        :value="key"
                    >
                        {{ label }}
                    </Select.Item>
                </Select.Content>
            </Select.Root>
            <Clickable.Button
                size="sm"
                variant="outline"
                :disabled="selected.length === 0"
                @click="deleteSelected"
            >
                <Trash2Icon aria-hidden="true" />
                Delete selected
            </Clickable.Button>
            <span :class="styles.count" data-testid="selected-count">
                {{ selected.length }} selected · {{ local.rows.length }} companies
            </span>
        </div>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :row-key="rowKey"
            :row-height="44"
            :header-row-height="40"
            row-selection="multiple"
            :selected-row-keys="selected"
            :on-selected-row-keys-change="setSelected"
            :class="styles.root"
            v-bind="local.props"
        >
            <DataGrid.Grid aria-label="Companies" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <DataGrid.HeaderCell
                                :cell="cell"
                                :class="styles.headerCell"
                            >
                                <HeaderContent :cell="cell" />
                                <Resizer :cell="cell" />
                            </DataGrid.HeaderCell>
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body>
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row
                            :row="row"
                            :class="styles.row(isSelected(row.key))"
                        >
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell
                                    :cell="cell"
                                    :class="styles.cell"
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
