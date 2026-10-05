"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import { hash, type Person, people } from "../_kit/data";
import * as styles from "./styles";

/** A person with notes of their own: one to four sentences, and a few skills. */
interface Profile extends Person {
    notes: string;
    skills: string[];
}

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

const columns: Column<Profile>[] = [
    { key: "name", name: "Name", width: 180, pinned: "start", sortable: true },
    { key: "team", name: "Team", width: 120, sortable: true },
    // the notes wrap: a row is as tall as its longest cell
    { key: "notes", name: "Notes", width: 360 },
    {
        key: "skills",
        name: "Skills",
        width: 240,
        renderCell: ({ row }) => (
            <span className={styles.skills}>
                {row.skills.map((skill) => (
                    <span key={skill} className={styles.skill}>
                        {skill}
                    </span>
                ))}
            </span>
        ),
    },
    { key: "city", name: "City", width: 130, sortable: true },
];

export default function AutoRowHeights() {
    // a sort moves the rows: the ones on screen keep their heights, the others are measured
    // again when they render (counted at the estimate until then)
    const local = useLocalRows(rows, columns);
    return (
        <div className={styles.frame}>
            <DataGrid.Root
                {...local.props}
                columns={columns}
                rowKey={(row) => row.id}
                // as tall as their content, measured once rendered; until then, about this tall
                rowHeight="auto"
                estimatedRowHeight={64}
                className={styles.root}
            >
                <DataGrid.Grid
                    aria-label="People and their notes"
                    className={styles.grid}
                >
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Profile>>
                                {(cell) => (
                                    <DataGrid.HeaderCell
                                        cell={cell}
                                        className={styles.headerCell}
                                    />
                                )}
                            </DataGrid.HeaderCells>
                        </DataGrid.HeaderRow>
                    </DataGrid.Header>
                    <DataGrid.Body>
                        <DataGrid.Rows<Profile>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Profile>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                className={styles.cell}
                                            />
                                        )}
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            )}
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>
        </div>
    );
}
