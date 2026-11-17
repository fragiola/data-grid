<script setup lang="ts">
import { type SummaryPosition, typedDataGrid } from "@fragiola/data-grid-vue";
import type { Person } from "../_kit/data";
import * as styles from "./styles";
import { SUMMARIES, type Totals } from "./totals";

// A position's summary rows: sticky, opaque, above the rows that scroll under them. Each cell
// shows the app's figure for its column, read here as it renders.

const DataGrid = typedDataGrid<Person>();

defineProps<{ position: SummaryPosition; totals: Totals }>();
</script>

<template>
    <DataGrid.Summary :position="position" :class="styles.summary">
        <DataGrid.SummaryRows v-slot="{ row }">
            <DataGrid.SummaryRow :row="row" :class="styles.summaryRow(row)">
                <DataGrid.SummaryCells v-slot="{ cell }">
                    <DataGrid.SummaryCell
                        :cell="cell"
                        :class="styles.summaryCell"
                    >
                        {{ SUMMARIES[cell.column.key]?.(totals, cell.position) }}
                    </DataGrid.SummaryCell>
                </DataGrid.SummaryCells>
            </DataGrid.SummaryRow>
        </DataGrid.SummaryRows>
    </DataGrid.Summary>
</template>
