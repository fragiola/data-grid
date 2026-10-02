"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(1_000);

const columns: Column<Person>[] = [
    { key: "id", name: "#", width: 60 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140 },
];

// No class on any part: the default children render the header names and the values. The only
// class sizes the frame, because a scroll container needs a size.
export default function Unstyled() {
    return (
        <div className={styles.frame}>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="People">
                    <DataGrid.Header />
                    <DataGrid.Body />
                </DataGrid.Grid>
            </DataGrid.Root>
        </div>
    );
}
