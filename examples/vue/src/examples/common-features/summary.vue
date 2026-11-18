<script setup lang="ts">
import type { SummaryPosition } from "@fragiola/data-grid-vue";
import * as DataGrid from "@fragiola/data-grid-vue/summary-rows";
import * as styles from "./styles";
import { SUMMARIES, type Totals } from "./summaries";

// A position's summary row: sticky, opaque, the app's figure in each cell. It never reads the
// row type: the summary rows' plain parts do (`@fragiola/data-grid-vue/summary-rows`).

defineProps<{ position: SummaryPosition; totals: Totals }>();
</script>

<template>
    <DataGrid.Summary :position="position" :class="styles.summary">
        <DataGrid.SummaryRows v-slot="{ row }">
            <DataGrid.SummaryRow :row="row" :class="styles.summaryRow(row)">
                <DataGrid.SummaryCells v-slot="{ cell }">
                    <DataGrid.SummaryCell :cell="cell">
                        <template #render="{ props, state }">
                            <div
                                v-bind="props"
                                :class="styles.summaryCell(state)"
                            >
                                {{
                                    SUMMARIES[cell.column.key]?.(
                                        totals,
                                        cell.position,
                                    )
                                }}
                            </div>
                        </template>
                    </DataGrid.SummaryCell>
                </DataGrid.SummaryCells>
            </DataGrid.SummaryRow>
        </DataGrid.SummaryRows>
    </DataGrid.Summary>
</template>
