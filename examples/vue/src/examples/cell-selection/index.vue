<script setup lang="ts">
import {
    type CellRange,
    type Column,
    type RangePaste,
    typedDataGrid,
} from "@fragiola/data-grid-vue";
import { clipboard } from "@fragiola/data-grid-vue/clipboard";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { cellRange } from "@fragiola/data-grid-vue/range";
import { h, ref, shallowRef, type VNodeChild } from "vue";
import { formatMoney, hash, person } from "../_kit/data";
import * as styles from "./styles";

// A year's budget, a line per row: the grid selects ranges of cells, copies them as TSV and tells
// each paste; the app sums what is selected and writes what is pasted into its own rows.

interface Line {
    id: number;
    item: string;
    owner: { readonly name: string };
    /** the amount of each month, January first */
    amounts: readonly number[];
}

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

const ITEMS = [
    "Cloud hosting",
    "Office rent",
    "Laptops",
    "Travel",
    "Training",
    "Software licences",
    "Marketing",
    "Events",
    "Contractors",
    "Recruiting",
];

function line(index: number): Line {
    return {
        id: index + 1,
        item: `${ITEMS[index % ITEMS.length]} ${Math.floor(index / ITEMS.length) + 1}`,
        owner: { name: person(index).name },
        amounts: MONTHS.map(
            (_, month) => 100 * (5 + hash(index * 13 + month, 120)),
        ),
    };
}

const budget = Array.from({ length: 60 }, (_, index) => line(index));

const totalOf = (row: Line) =>
    row.amounts.reduce((total, amount) => total + amount, 0);

const columns: Column<Line, VNodeChild>[] = [
    { key: "item", name: "Line", width: 180, pinned: "start" },
    {
        key: "owner",
        name: "Owner",
        width: 150,
        getValue: (row) => row.owner,
        renderCell: ({ row }) =>
            h("span", { class: styles.owner }, row.owner.name),
        // the value is an object: the clipboard gets its name (without it, nothing)
        getCopyText: ({ row }) => row.owner.name,
    },
    ...MONTHS.map(
        (name, month): Column<Line, VNodeChild> => ({
            key: `m${month}`,
            name,
            width: 96,
            getValue: (row) => row.amounts[month] ?? 0,
            // shown as money, copied as the number it is (its value as text)
            renderCell: ({ value }) => formatMoney(Number(value)),
        }),
    ),
    {
        key: "total",
        name: "Total",
        width: 120,
        pinned: "end",
        getValue: totalOf,
        renderCell: ({ value }) =>
            h("span", { class: styles.total }, formatMoney(Number(value))),
    },
];

const TOTAL = columns.length - 1;

/** A range's rows and columns, first to last, whichever corner it was started from. */
function boundsOf({ anchor, focus }: CellRange) {
    return {
        top: Math.min(anchor.rowIndex, focus.rowIndex),
        bottom: Math.max(anchor.rowIndex, focus.rowIndex),
        start: Math.min(anchor.columnIndex, focus.columnIndex),
        end: Math.max(anchor.columnIndex, focus.columnIndex),
    };
}

/** What the app says of a range: its size and the sum of its amounts (the totals included). */
function describeRange(rows: readonly Line[], range: CellRange): string {
    const { top, bottom, start, end } = boundsOf(range);
    let sum = 0;
    for (let rowIndex = top; rowIndex <= bottom; rowIndex++) {
        const row = rows[rowIndex];
        for (let index = start; index <= end; index++) {
            const value = row && columns[index]?.getValue?.(row, rowIndex);
            if (typeof value === "number") sum += value;
        }
    }
    return `${bottom - top + 1} × ${end - start + 1} cells · Sum ${formatMoney(sum)}`;
}

/** A pasted text as an amount: digits, a sign and decimals ($ and commas dropped), else none. */
function amountOf(text: string): number | undefined {
    const cleaned = text.replace(/[$,\s]/g, "");
    return /^-?\d+(\.\d+)?$/.test(cleaned)
        ? Math.round(Number(cleaned))
        : undefined;
}

/**
 * The rows with a paste written into them, as the app's rules say: a line's name and its owner as
 * text, a month's amount when the text is one (else left as it was, counted).
 */
function withPaste(
    rows: readonly Line[],
    { range, values }: RangePaste,
): { rows: Line[]; skipped: number } {
    const next = [...rows];
    let skipped = 0;
    values.forEach((texts, offset) => {
        const rowIndex = range.anchor.rowIndex + offset;
        const current = next[rowIndex];
        if (!current) return;
        let item = current.item;
        let owner = current.owner;
        const amounts = [...current.amounts];
        texts.forEach((text, at) => {
            const key = columns[range.anchor.columnIndex + at]?.key ?? "";
            if (key === "item") item = text;
            else if (key === "owner") owner = { name: text };
            else if (key.startsWith("m")) {
                const amount = amountOf(text);
                if (amount === undefined) skipped += 1;
                else amounts[Number(key.slice(1))] = amount;
            }
        });
        next[rowIndex] = { ...current, item, owner, amounts };
    });
    return { rows: next, skipped };
}

// the features the grid installs: cell navigation (the keys, the active cell, the tab stop), cell
// ranges, the clipboard (a range's copy and paste)
const features = [navigation(), cellRange(), clipboard()] as const;

// the parts typed by the row type: a template cannot pass `Line` as a type argument
const DataGrid = typedDataGrid<Line, typeof features>();

// the app's rows: the grid never writes them, a paste is told
const rows = shallowRef<readonly Line[]>(budget);
// the range, controlled: the app sums it as it changes
const range = shallowRef<CellRange | null>(null);
const announcement = ref("");

const rowKey = (row: Line) => row.id;
const setRange = (next: CellRange | null) => {
    range.value = next;
};

// the totals are worked out: a paste reaching them is refused whole
function beforePaste(paste: RangePaste) {
    if (boundsOf(paste.range).end < TOTAL) return true;
    announcement.value =
        "Totals are worked out from the months: paste into the lines, owners or months.";
    return false;
}

function writePaste(paste: RangePaste) {
    const { rows: next, skipped } = withPaste(rows.value, paste);
    rows.value = next;
    const count = paste.values.length * (paste.values[0]?.length ?? 0);
    announcement.value = `Pasted ${count} ${count === 1 ? "cell" : "cells"}${
        skipped > 0
            ? `; ${skipped} not an amount, left as ${skipped === 1 ? "it was" : "they were"}`
            : ""
    }.`;
}
</script>

<template>
    <div :class="styles.frame">
        <div :class="styles.toolbar">
            <span>
                <kbd :class="styles.key">Shift</kbd> + arrows or a drag select;
                <kbd :class="styles.key">Ctrl/⌘</kbd>
                <kbd :class="styles.key">C</kbd> copies,
                <kbd :class="styles.key">Ctrl/⌘</kbd>
                <kbd :class="styles.key">V</kbd> pastes
            </span>
            <span :class="styles.summary">
                {{ range ? describeRange(rows, range) : "No range selected" }}
            </span>
            <!-- the app's live region: a polite status, its text the app's own -->
            <span role="status" :class="styles.status">{{ announcement }}</span>
        </div>
        <DataGrid.Root
            :features="features"
            :columns="columns"
            :rows="rows"
            :row-key="rowKey"
            :row-height="36"
            cell-selection="range"
            :selected-range="range"
            :on-selected-range-change="setRange"
            :on-before-range-paste="beforePaste"
            :on-range-paste="writePaste"
            :class="styles.root"
        >
            <DataGrid.Grid aria-label="Budget" :class="styles.grid">
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
                                />
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
    </div>
</template>
