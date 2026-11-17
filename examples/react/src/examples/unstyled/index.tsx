"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { navigation } from "@fragiola/data-grid-react/navigation";
import { type Person, people } from "../_kit/data";
import * as styles from "./styles";

// cell navigation is a feature the grid installs: the keys, the active cell and the tab stop
const FEATURES = [navigation()];

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
                features={FEATURES}
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
