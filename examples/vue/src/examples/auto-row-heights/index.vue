<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import { columnPinning } from "@fragiola/data-grid-vue/column-pinning";
import { useLocalRows } from "@fragiola/data-grid-vue/local";
import { navigation } from "@fragiola/data-grid-vue/navigation";
import { sorting } from "@fragiola/data-grid-vue/sorting";
import { h, type VNodeChild } from "vue";
import { hash, type Person, people } from "../_kit/data";
import * as styles from "./styles";

/** A person with notes of their own: one to four sentences, and a few skills. */
interface Profile extends Person {
    notes: string;
    skills: string[];
}

// the features the grid installs: sorting (without it, a sortable column never sorts), cell
// navigation (the keys, the active cell, the tab stop), pinned columns (without it, every column
// scrolls)
const features = [sorting(), navigation(), columnPinning()] as const;

// The parts typed by the row type and the features: a template cannot pass them as type
// arguments.
const DataGrid = typedDataGrid<Profile, typeof features>();

const SENTENCES = [
    "Prefers asynchronous reviews and writes the longest pull request descriptions on the team.",
    "Owns the release checklist this quarter.",
    "Mentoring two new hires through their first on-call rotation, with a weekly pairing session.",
    "On call next week.",
    "Moved from the data team in the spring; still the person to ask about the old pipelines.",
    "Out on Fridays.",
    "Leads the accessibility guild, and runs its monthly audit of every public page.",
    "Speaks at two conferences this year.",
];

const SKILLS = [
    "TypeScript",
    "Rust",
    "SQL",
    "Design systems",
    "Accessibility",
    "Kubernetes",
    "Writing",
    "Mentoring",
    "Testing",
    "Go",
];

/** A row's notes and skills, from its id: the same every time, of every length. */
const rows: Profile[] = people(100_000).map((person) => ({
    ...person,
    notes: Array.from(
        { length: 1 + hash(person.id + 31, 4) },
        (_, sentence) =>
            SENTENCES[hash(person.id * 7 + sentence, SENTENCES.length)],
    ).join(" "),
    // each once
    skills: [
        ...new Set(
            Array.from(
                { length: 1 + hash(person.id + 57, 5) },
                (_, skill) =>
                    SKILLS[hash(person.id * 3 + skill, SKILLS.length)] ?? "",
            ),
        ),
    ],
}));

const columns: Column<Profile, VNodeChild>[] = [
    { key: "name", name: "Name", width: 180, pinned: "start", sortable: true },
    { key: "team", name: "Team", width: 120, sortable: true },
    // the notes wrap: a row is as tall as its longest cell
    { key: "notes", name: "Notes", width: 360 },
    {
        key: "skills",
        name: "Skills",
        width: 240,
        renderCell: ({ row }) =>
            h(
                "span",
                { class: styles.skills },
                row.skills.map((skill) =>
                    h("span", { key: skill, class: styles.skill }, skill),
                ),
            ),
    },
    { key: "city", name: "City", width: 130, sortable: true },
];

// a sort moves the rows: the ones on screen keep their heights, the others are measured
// again when they render (counted at the estimate until then)
const local = useLocalRows(rows, columns);

const rowKey = (row: Profile) => row.id;
</script>

<template>
    <div :class="styles.frame">
        <!-- as tall as their content, measured once rendered; until then, about this tall -->
        <DataGrid.Root
            :features="features"
            v-bind="local.props"
            :columns="columns"
            :row-key="rowKey"
            row-height="auto"
            :estimated-row-height="64"
            :class="styles.root"
        >
            <DataGrid.Grid
                aria-label="People and their notes"
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
