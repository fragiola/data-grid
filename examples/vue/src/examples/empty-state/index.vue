<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { Plus, Trash2, UsersRound } from "@lucide/vue";
import {
    type ComponentPublicInstance,
    ref,
    shallowRef,
    type VNodeChild,
} from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { type Person, people } from "../_kit/data";
import * as styles from "./styles";

// The parts typed by the row type: a template cannot pass `Person` as a type argument.
const DataGrid = typedDataGrid<Person>();

const SAMPLE = people(50);

const columns: Column<Person, VNodeChild>[] = [
    { key: "id", name: "#", width: 64 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140 },
    { key: "team", name: "Team", width: 120 },
];

const rows = shallowRef<Person[]>([]);
// a template ref on a part is its component instance: the element is its `$el`
const grid = ref<ComponentPublicInstance | null>(null);

const rowKey = (row: Person) => row.id;

function clearAll() {
    rows.value = [];
}

function addSample() {
    rows.value = SAMPLE;
    // the button goes away with the empty state: keep focus in the grid
    const element: unknown = grid.value?.$el;
    if (element instanceof HTMLElement) element.focus();
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span :class="styles.count" data-testid="row-count">
                {{ rows.length }} people
            </span>
            <Clickable.Button
                size="sm"
                variant="ghost"
                :disabled="rows.length === 0"
                @click="clearAll"
            >
                <Trash2 aria-hidden="true" />
                Clear all
            </Clickable.Button>
        </div>
        <DataGrid.Root
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="36"
            :class="styles.root"
        >
            <DataGrid.Grid
                ref="grid"
                aria-label="People"
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
                <!-- the grid's cell while it has no rows: the content laid out in it -->
                <DataGrid.Empty :class="styles.empty" data-testid="empty">
                    <div :class="styles.illustration">
                        <UsersRound aria-hidden="true" />
                    </div>
                    <p :class="styles.emptyTitle">No people yet</p>
                    <p :class="styles.emptyText">
                        Add a few sample rows to see the grid fill up, then
                        clear them to come back here.
                    </p>
                    <Clickable.Button size="sm" @click="addSample">
                        <Plus aria-hidden="true" />
                        Add sample rows
                    </Clickable.Button>
                </DataGrid.Empty>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
