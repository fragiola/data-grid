<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { computed, h, ref, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { type Project, projects, STATUS_LABELS } from "../_kit/portfolio";
import * as styles from "./styles";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const features = [navigation()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Project, typeof features>();

const rows = projects(300);

/** The columns, rendered through the preset in use: the markup never changes, only classes. */
function columnsFor(preset: styles.Preset): Column<Project, VNodeChild>[] {
    return [
        { key: "id", name: "#", width: 64 },
        { key: "name", name: "Project", width: 160 },
        { key: "owner", name: "Owner", width: 170 },
        {
            key: "status",
            name: "Status",
            width: 120,
            renderCell: ({ row }) =>
                h(
                    "span",
                    { class: preset.status(row.status) },
                    STATUS_LABELS[row.status],
                ),
        },
        { key: "score", name: "Health", width: 100 },
        {
            key: "delta",
            name: "Change",
            width: 96,
            renderCell: ({ row }) =>
                h(
                    "span",
                    { class: preset.delta(row.delta) },
                    row.delta > 0 ? `+${row.delta}` : String(row.delta),
                ),
        },
        {
            key: "shipped",
            name: "Shipped",
            width: 90,
            renderCell: ({ row }) =>
                h(
                    "span",
                    { class: preset.shipped(row.shipped) },
                    row.shipped ? "✓" : "✗",
                ),
        },
        {
            key: "tag",
            name: "Area",
            width: 120,
            renderCell: ({ row }) =>
                h("span", { class: preset.tag(row.tag) }, row.tag),
        },
    ];
}

const name = ref<styles.PresetName>("spreadsheet");
const preset = computed(() => styles.PRESETS[name.value]);
const columns = computed(() => columnsFor(preset.value));

const rowKey = (row: Project) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <fieldset :class="styles.toolbar">
            <legend :class="styles.legend">Style</legend>
            <Clickable.Button
                v-for="key in styles.PRESET_NAMES"
                :key="key"
                size="sm"
                variant="ghost"
                :aria-pressed="key === name"
                :class="styles.presetButton"
                @click="name = key"
            >
                {{ styles.PRESETS[key].title }}
            </Clickable.Button>
        </fieldset>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="preset.rowHeight"
            :default-active-position="{ rowIndex: 0, columnIndex: 1 }"
            :class="preset.root"
            :data-preset="name"
        >
            <DataGrid.Grid aria-label="Projects">
                <DataGrid.Header :class="preset.header">
                    <DataGrid.HeaderRow :class="preset.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <DataGrid.HeaderCell
                                :cell="cell"
                                :class="
                                    preset.headerCell(styles.columnKey(cell.key))
                                "
                            />
                        </DataGrid.HeaderCells>
                    </DataGrid.HeaderRow>
                </DataGrid.Header>
                <DataGrid.Body>
                    <DataGrid.Rows v-slot="{ row }">
                        <DataGrid.Row
                            :row="row"
                            :class="preset.row(row, row.row?.status)"
                        >
                            <DataGrid.Cells v-slot="{ cell }">
                                <DataGrid.Cell
                                    :cell="cell"
                                    :class="
                                        styles.cellClass(
                                            preset,
                                            styles.columnKey(cell.column.key),
                                            cell.row?.score,
                                        )
                                    "
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
