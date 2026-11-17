<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { RefreshCw, TriangleAlert } from "@lucide/vue";
import {
    computed,
    onBeforeUnmount,
    onMounted,
    ref,
    shallowRef,
    useId,
    type VNodeChild,
} from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { Switch } from "#/components/ui/switch";
import { formatMoney, type Person, person } from "../_kit/data";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

const COUNT = 40;
/** the skeleton rows the first load shows: about a screen's worth */
const SKELETON_ROWS = 12;
const LATENCY = 700;

/**
 * The app's request: the people after a delay, or a failure when asked to fail. Swap it for a
 * `fetch` to your API; the states below do not change.
 */
function fetchPeople(fail: boolean): Promise<Person[]> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (fail) reject(new Error("The server did not answer."));
            else resolve(Array.from({ length: COUNT }, (_, i) => person(i)));
        }, LATENCY);
    });
}

const columns: Column<Person, VNodeChild>[] = [
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

/** What the app knows of its rows: nothing yet, some, and whether a request runs or failed. */
interface LoadState {
    readonly rows: readonly Person[] | null;
    readonly loading: boolean;
    readonly error: string | null;
}

const state = shallowRef<LoadState>({
    rows: null,
    loading: true,
    error: null,
});
// the next request fails: the app's switch, to see the error states
const failNext = ref(false);
let request = 0;
const failLabel = useId();

/** Requests the rows; `fresh` drops the ones on screen first (a first load again). */
function load(fresh = false) {
    // an answer to a request the app has moved on from is dropped
    const id = ++request;
    state.value = {
        rows: fresh ? null : state.value.rows,
        loading: true,
        error: null,
    };
    fetchPeople(failNext.value).then(
        (rows) => {
            if (id === request) {
                state.value = { rows, loading: false, error: null };
            }
        },
        (error: Error) => {
            if (id === request) {
                state.value = {
                    ...state.value,
                    loading: false,
                    error: error.message,
                };
            }
        },
    );
}

onMounted(() => load());
// a request still running when the example goes away is dropped
onBeforeUnmount(() => {
    request += 1;
});

const rows = computed(() => state.value.rows);
const loading = computed(() => state.value.loading);
const error = computed(() => state.value.error);
// the first load: skeleton rows, every one "not loaded yet" (`data-loading`); a failed one,
// none (the empty state shows the error); then the rows, kept through a refetch
const rowCount = computed(() =>
    rows.value ? rows.value.length : error.value ? 0 : SKELETON_ROWS,
);
const getRow = computed(() => {
    const current = rows.value;
    return (index: number) => current?.[index];
});
const refreshing = computed(() => loading.value && rows.value !== null);
const status = computed(() =>
    loading.value
        ? rows.value
            ? "Refreshing…"
            : "Loading…"
        : error.value
          ? "Failed"
          : `${rows.value?.length ?? 0} people`,
);

const rowKey = (row: Person) => row.id;
const setFailNext = (fail: boolean) => {
    failNext.value = fail;
};
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <Clickable.Button
                size="sm"
                variant="outline"
                :disabled="loading"
                @click="load()"
            >
                <RefreshCw aria-hidden="true" />
                Refetch
            </Clickable.Button>
            <Clickable.Button
                size="sm"
                variant="ghost"
                :disabled="loading"
                @click="load(true)"
            >
                Start over
            </Clickable.Button>
            <span :class="styles.fail">
                <Switch.Root
                    :aria-labelledby="failLabel"
                    :model-value="failNext"
                    @update:model-value="setFailNext"
                >
                    <Switch.Thumb />
                </Switch.Root>
                <span :id="failLabel">Fail the next request</span>
            </span>
            <span
                :class="styles.status"
                data-testid="status"
                aria-live="polite"
            >
                {{ status }}
            </span>
        </div>
        <!-- a refetch that failed: the rows stay, the error and its retry above them -->
        <div
            v-if="error && rows"
            :class="styles.banner"
            role="alert"
            data-testid="banner"
        >
            <TriangleAlert aria-hidden="true" :size="16" />
            <span>Could not refresh: {{ error }}</span>
            <Clickable.Button size="sm" variant="ghost" @click="load()">
                Retry
            </Clickable.Button>
        </div>
        <DataGrid.Root
            :columns="columns"
            :row-count="rowCount"
            :get-row="getRow"
            :row-key="rowKey"
            :row-height="36"
            :class="styles.root"
        >
            <DataGrid.Grid
                aria-label="People"
                :aria-busy="loading || undefined"
                :class="styles.grid"
            >
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
                <DataGrid.Body :class="styles.body(refreshing)">
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row :row="row" :class="styles.row(row)">
                            <DataGrid.Cells v-slot="{ cell }">
                                <!-- loaded, the cell's own content; not yet, a skeleton -->
                                <DataGrid.Cell
                                    :cell="cell"
                                    :class="styles.cell"
                                >
                                    <template v-if="!cell.loaded" #default>
                                        <span :class="styles.skeleton" />
                                    </template>
                                </DataGrid.Cell>
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
                <!-- the first load failed: the error and its retry, in the grid's own cell -->
                <DataGrid.Empty :class="styles.error" data-testid="error">
                    <TriangleAlert aria-hidden="true" :size="28" />
                    <p :class="styles.errorTitle">
                        The people could not be loaded
                    </p>
                    <p :class="styles.errorText">{{ error }}</p>
                    <Clickable.Button
                        size="sm"
                        :disabled="loading"
                        @click="load()"
                    >
                        <RefreshCw aria-hidden="true" />
                        Retry
                    </Clickable.Button>
                </DataGrid.Empty>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
