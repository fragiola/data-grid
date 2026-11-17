<script setup lang="ts">
import {
    type Column,
    type RowKey,
    typedDataGrid,
    useDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-vue";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "@lucide/vue";
import {
    computed,
    h,
    provide,
    ref,
    shallowRef,
    type VNodeChild,
    watch,
} from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { formatNumber, type Person, person } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";
import RequestLog from "./request-log.vue";
import { SELECT_ALL } from "./select-all";
import SelectAll from "./select-all.vue";
import SelectRow from "./select-row.vue";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

const TOTAL = 10_000;
const PAGE_SIZE = 50;

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

const columns: Column<Person, VNodeChild>[] = [
    {
        key: "select",
        width: 48,
        renderHeaderCell: () => h(SelectAll, { total: TOTAL }),
        renderCell: ({ row, rowIndex }) =>
            h(SelectRow, { rowIndex, name: row.name }),
    },
    { key: "id", name: "#", width: 80 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "team", name: "Team", width: 120 },
];

const pageIndex = ref(0);
const rows = shallowRef<readonly Person[]>([]);
const selection = shallowRef<Selection>(NONE);
const exported = ref("");
const gridRef = useDataGridRef<Person>();
const grid = useDataGrid(gridRef);

watch(
    pageIndex,
    (index, _, onCleanup) => {
        let current = true;
        api.fetchPage(index, PAGE_SIZE, TOTAL, person).then((answer) => {
            if (current) rows.value = answer;
        });
        onCleanup(() => {
            current = false;
        });
    },
    { immediate: true },
);

// "Select every row" (Ctrl/⌘+A, the header's box) is the server's: the grid only holds a
// page, so a middleware turns the command, once it went through (not refused, not a dry run),
// into the app's own "all"; the grid selects the page's rows (what it shows of it)
watch(
    grid,
    (current, _, onCleanup) => {
        if (!current) return;
        onCleanup(
            current.model.use((ctx, next) => {
                const result = next();
                if (
                    ctx.command === "selected-rows.select-all" &&
                    result.ok &&
                    !ctx.dryRun
                ) {
                    selection.value = { all: true, keys: new Set() };
                }
                return result;
            }),
        );
    },
    { immediate: true },
);

const count = computed(() => countOf(selection.value));
provide(
    SELECT_ALL,
    computed(() => ({
        count: count.value,
        toggle: (checked: boolean) => {
            if (checked) grid.value?.model.run("selected-rows.select-all", {});
            else selection.value = NONE;
        },
    })),
);

// the grid's part of the selection: the page's selected rows
const selectedRowKeys = computed(() =>
    rows.value
        .filter((row) => isSelected(selection.value, row.id))
        .map((row) => row.id),
);

const pageSelected = computed(
    () =>
        rows.value.length > 0 &&
        selectedRowKeys.value.length === rows.value.length,
);
const pages = Math.ceil(TOTAL / PAGE_SIZE);

function exportSelection() {
    // the server gets the selection as the app keeps it, not ten thousand keys
    const what = describe(selection.value);
    api.fetchQuery(`export ${what}`, () => ({
        rows: [],
        total: count.value,
    })).then(() => {
        exported.value = `Exported ${what}`;
    });
}

function clearSelection() {
    selection.value = NONE;
}

function selectEveryRow() {
    grid.value?.model.run("selected-rows.select-all", {});
}

function setSelected(next: readonly RowKey[]) {
    // the page's rows as the grid has them now; the other pages' stay
    const chosen = new Set(next);
    const current = selection.value;
    const keys = new Set(current.keys);
    for (const row of rows.value) {
        // all: the keys are the rows left out; else the rows chosen
        if (chosen.has(row.id) !== current.all) {
            keys.add(row.id);
        } else keys.delete(row.id);
    }
    selection.value = { all: current.all, keys };
}

const rowKey = (row: Person) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span :class="styles.count" data-testid="selected-count">
                {{ formatNumber(count) }} of {{ formatNumber(TOTAL) }} selected
            </span>
            <Clickable.Button
                size="sm"
                variant="outline"
                :disabled="count === 0"
                @click="exportSelection"
            >
                <DownloadIcon aria-hidden="true" />
                Export
            </Clickable.Button>
            <span :class="styles.exported" data-testid="exported">
                {{ exported }}
            </span>
        </div>
        <div v-if="selection.all" :class="styles.banner" data-testid="banner">
            <span>
                All {{ formatNumber(count) }} people are selected{{
                    selection.keys.size > 0
                        ? ` (${formatNumber(selection.keys.size)} left out)`
                        : ""
                }}.
            </span>
            <Clickable.Button size="sm" variant="ghost" @click="clearSelection">
                Clear selection
            </Clickable.Button>
        </div>
        <div
            v-else-if="pageSelected"
            :class="styles.banner"
            data-testid="banner"
        >
            <span> The {{ rows.length }} people on this page are selected. </span>
            <Clickable.Button size="sm" variant="ghost" @click="selectEveryRow">
                Select all {{ formatNumber(TOTAL) }}
            </Clickable.Button>
        </div>
        <div :class="styles.layout">
            <DataGrid.Root
                :columns="columns"
                :rows="rows"
                :row-key="rowKey"
                :row-height="40"
                row-selection="multiple"
                :selected-row-keys="selectedRowKeys"
                :on-selected-row-keys-change="setSelected"
                :grid-ref="gridRef"
                :class="styles.root"
            >
                <DataGrid.Grid aria-label="People" :class="styles.grid">
                    <DataGrid.Header :class="styles.header">
                        <DataGrid.HeaderRow :class="styles.headerRow">
                            <DataGrid.HeaderCells v-slot="{ cell }">
                                <DataGrid.HeaderCell
                                    :cell="cell"
                                    :class="styles.headerCell"
                                />
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                    <DataGrid.Body>
                        <DataGrid.Rows v-slot="{ row }">
                            <DataGrid.Row :row="row" :class="styles.row(row)">
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
            <RequestLog :api="api" />
        </div>
        <nav :class="styles.pager" aria-label="Pages">
            <Clickable.Button
                size="sm"
                variant="outline"
                aria-label="Previous page"
                :disabled="pageIndex === 0"
                @click="pageIndex = Math.max(0, pageIndex - 1)"
            >
                <ChevronLeftIcon aria-hidden="true" />
            </Clickable.Button>
            <span :class="styles.pageOf" data-testid="page">
                Page {{ pageIndex + 1 }} of {{ pages }}
            </span>
            <Clickable.Button
                size="sm"
                variant="outline"
                aria-label="Next page"
                :disabled="pageIndex >= pages - 1"
                @click="pageIndex = Math.min(pages - 1, pageIndex + 1)"
            >
                <ChevronRightIcon aria-hidden="true" />
            </Clickable.Button>
        </nav>
    </div>
</template>
