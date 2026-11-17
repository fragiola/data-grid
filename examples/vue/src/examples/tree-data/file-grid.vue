<script setup lang="ts">
import { type RowKey, typedDataGrid } from "@fragiola/data-grid-vue";
import type { Entry } from "./files";
import NameCell from "./name-cell.vue";
import SelectEntry from "./select-entry.vue";
import * as styles from "./styles";

// The grid's parts, the same for both modes: a header row and the rows' cells.

const DataGrid = typedDataGrid<Entry>();

defineProps<{ subRowKeysOf: (rowIndex: number) => readonly RowKey[] }>();
</script>

<template>
    <DataGrid.Grid aria-label="Files" :class="styles.grid">
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
                        <DataGrid.Cell :cell="cell" :class="styles.cell">
                            <template
                                v-if="cell.column.key === 'select'"
                                #default
                            >
                                <SelectEntry
                                    :cell="cell"
                                    :sub-row-keys-of="subRowKeysOf"
                                />
                            </template>
                            <template
                                v-else-if="cell.column.key === 'name'"
                                #default
                            >
                                <NameCell :cell="cell" :depth="row.depth" />
                            </template>
                        </DataGrid.Cell>
                    </DataGrid.Cells>
                </DataGrid.Row>
            </DataGrid.Rows>
        </DataGrid.Body>
    </DataGrid.Grid>
</template>
