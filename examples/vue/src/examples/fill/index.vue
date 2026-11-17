<script setup lang="ts">
import {
    type CellRange,
    type Column,
    type RangeFill,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { fillHandle, repeatedFill } from "@fragiola/data-grid-vue/fill";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { cellRange } from "@fragiola/data-grid-vue/range";
import { ref, shallowRef, type VNodeChild } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { hash } from "../_kit/data";
import FillHandle from "./fill-handle.vue";
import * as styles from "./styles";

// A shipping plan: units per product and week. A range's corner holds a handle; dragging it down
// or across fills the cells it reaches. The grid tells the fill; the app makes the values: the
// source repeated, or its series continued.

interface Plan {
    id: number;
    product: string;
    /** units shipped each week, the first week first */
    weeks: readonly number[];
}

const WEEKS = 10;

const PRODUCTS = ["Chairs", "Desks", "Lamps", "Shelves", "Monitors", "Cables"];

const initialPlans: Plan[] = Array.from({ length: 40 }, (_, index) => ({
    id: index + 1,
    product: `${PRODUCTS[index % PRODUCTS.length]} ${Math.floor(index / PRODUCTS.length) + 1}`,
    weeks: Array.from({ length: WEEKS }, (_, week) =>
        week < 3 ? 10 * (1 + hash(index * 11 + week, 20)) : 0,
    ),
}));

/** How a fill fills: the source repeated, or each line's series continued. */
type Mode = "repeat" | "series";

const columns: Column<Plan, VNodeChild>[] = [
    { key: "product", name: "Product", width: 160, pinned: "start" },
    ...Array.from(
        { length: WEEKS },
        (_, week): Column<Plan, VNodeChild> => ({
            key: `w${week}`,
            name: `Week ${week + 1}`,
            width: 92,
            getValue: (plan) => plan.weeks[week] ?? 0,
        }),
    ),
];

/**
 * Each line of the source continued (a series): along a fill down, each column's last two values
 * give the step; across, each row's. One value repeats.
 */
function seriesFill(
    { source, target }: RangeFill,
    valueAt: (rowIndex: number, columnIndex: number) => number,
) {
    const down = target.anchor.rowIndex > source.focus.rowIndex;
    const cells: { rowIndex: number; columnIndex: number; value: number }[] =
        [];
    for (
        let row = target.anchor.rowIndex;
        row <= target.focus.rowIndex;
        row++
    ) {
        for (
            let column = target.anchor.columnIndex;
            column <= target.focus.columnIndex;
            column++
        ) {
            const last = down
                ? valueAt(source.focus.rowIndex, column)
                : valueAt(row, source.focus.columnIndex);
            const before = down
                ? source.focus.rowIndex > source.anchor.rowIndex
                    ? valueAt(source.focus.rowIndex - 1, column)
                    : last
                : source.focus.columnIndex > source.anchor.columnIndex
                  ? valueAt(row, source.focus.columnIndex - 1)
                  : last;
            const steps = down
                ? row - source.focus.rowIndex
                : column - source.focus.columnIndex;
            cells.push({
                rowIndex: row,
                columnIndex: column,
                value: Math.max(0, last + (last - before) * steps),
            });
        }
    }
    return cells;
}

/** A range from the first week column on (the product column is no units). */
function weeksOf(range: CellRange): CellRange {
    return {
        anchor: {
            rowIndex: range.anchor.rowIndex,
            columnIndex: Math.max(1, range.anchor.columnIndex),
        },
        focus: range.focus,
    };
}

/**
 * The fill of the units: its source and its target from the first week on, `null` for a source
 * holding only the product (no units to fill from).
 */
function unitsFill({ source, target }: RangeFill): RangeFill | null {
    return source.focus.columnIndex < 1
        ? null
        : { source: weeksOf(source), target: weeksOf(target) };
}

// the features the grid installs: cell navigation (the keys, the active cell, the tab stop), cell
// ranges, the fill handle, pinned columns (without it, every column scrolls)
const features = [
    navigation(),
    cellRange(),
    fillHandle(),
    columnPinning(),
] as const;

// the parts typed by the row type: a template cannot pass `Plan` as a type argument
const DataGrid = typedDataGrid<Plan, typeof features>();

const MODES = ["repeat", "series"] as const;

// the app's rows: the grid never writes them, a fill is told
const plans = shallowRef<readonly Plan[]>(initialPlans);
const mode = ref<Mode>("repeat");
const announcement = ref("");

/** a week cell's units, from the app's rows */
const unitsAt = (rowIndex: number, columnIndex: number) =>
    plans.value[rowIndex]?.weeks[columnIndex - 1] ?? 0;

const planKey = (plan: Plan) => plan.id;

function fill(filled: RangeFill) {
    // the units only: the product's name is neither filled nor filled from
    const units = unitsFill(filled);
    if (!units) return;
    const cells =
        mode.value === "series"
            ? seriesFill(units, unitsAt)
            : repeatedFill(units, (at) => unitsAt(at.rowIndex, at.columnIndex));
    plans.value = plans.value.map((plan, rowIndex) => {
        const mine = cells.filter((cell) => cell.rowIndex === rowIndex);
        if (mine.length === 0) return plan;
        const weeks = [...plan.weeks];
        for (const cell of mine) {
            weeks[cell.columnIndex - 1] = Number(cell.value);
        }
        return { ...plan, weeks };
    });
    announcement.value = `Filled ${cells.length} ${cells.length === 1 ? "cell" : "cells"}.`;
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span>Drag the square at a range's corner down or across. A fill</span>
            <div :class="styles.modes">
                <Clickable.Button
                    v-for="option in MODES"
                    :key="option"
                    size="sm"
                    :variant="mode === option ? 'solid' : 'outline'"
                    :aria-pressed="mode === option"
                    @click="mode = option"
                >
                    {{ option === "repeat" ? "repeats" : "continues a series" }}
                </Clickable.Button>
            </div>
            <!-- the app's live region: a polite status, its text the app's own -->
            <span role="status" :class="styles.status">{{ announcement }}</span>
        </div>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="plans"
            :row-key="planKey"
            :row-height="36"
            cell-selection="range"
            :on-fill="fill"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Shipping plan" :class="styles.grid">
                <DataGrid.Header :class="styles.header">
                    <DataGrid.HeaderRow :class="styles.headerRow">
                        <DataGrid.HeaderCells v-slot="{ cell }">
                            <DataGrid.HeaderCell
                                :cell="cell"
                                :class="styles.headerCell(cell)"
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
                                    :class="styles.cell(cell)"
                                >
                                    {{ String(cell.value ?? "") }}<FillHandle :cell="cell" />
                                </DataGrid.Cell>
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
