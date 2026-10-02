import type { Column, ColumnOrGroup } from "../../src";

// The column tree the header tests share: three header rows, a shallow column (D) under a group,
// and a top-level column (A) spanning every header row.
//
//   row -3:  A (3 rows) | G1 ─────────────── | G3 ──────
//   row -2:             | G2 ────── | D (2)  | G4 ──────
//   row -1:             | B   | C   |        | E   | F
//   columns:  0           1     2     3        4     5

export interface Row {
    id: number;
}

export const leaf = (key: string, width = 100): Column<Row> => ({ key, width });

export const TREE: ColumnOrGroup<Row>[] = [
    leaf("A"),
    {
        key: "G1",
        name: "Group one",
        children: [{ key: "G2", children: [leaf("B"), leaf("C")] }, leaf("D")],
    },
    { key: "G3", children: [{ key: "G4", children: [leaf("E"), leaf("F")] }] },
];

/** Every header cell's position, by key. */
export const CELLS = {
    A: { rowIndex: -3, columnIndex: 0 },
    G1: { rowIndex: -3, columnIndex: 1 },
    G3: { rowIndex: -3, columnIndex: 4 },
    G2: { rowIndex: -2, columnIndex: 1 },
    D: { rowIndex: -2, columnIndex: 3 },
    G4: { rowIndex: -2, columnIndex: 4 },
    B: { rowIndex: -1, columnIndex: 1 },
    C: { rowIndex: -1, columnIndex: 2 },
    E: { rowIndex: -1, columnIndex: 4 },
    F: { rowIndex: -1, columnIndex: 5 },
} as const;

export type CellKey = keyof typeof CELLS;
