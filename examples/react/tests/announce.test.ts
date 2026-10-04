import { type ColumnOrGroup, createDataGridModel } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
    activeHeaderKey,
    describeMove,
} from "../src/examples/column-reordering/announce";

// The column-reordering example's announcement: told from the grid's own header before and after
// a move, so it says what the grid shows, the pinned columns' split included.

interface Row {
    id: number;
}

const column = (key: string, pinned = false) => ({
    key,
    name: key.toUpperCase(),
    width: 100,
    reorderable: true,
    ...(pinned ? { pinned: "start" as const } : {}),
});

const COLUMNS: ColumnOrGroup<Row, ReactNode>[] = [
    column("p", true),
    column("q", true),
    column("a"),
    {
        key: "g",
        name: "Group",
        reorderable: true,
        children: [column("c"), column("d")],
    },
    column("b"),
];

/** The announcement of one move, run on a model of the example's kind. */
function announced(
    columnKey: string,
    targetKey: string,
    side: "before" | "after",
    columnOrder: readonly string[] = [],
) {
    const model = createDataGridModel<Row, ReactNode>({
        columns: COLUMNS,
        rows: [],
        columnOrder,
    });
    // the moved one is the active one: pressed, or moved with the keys
    const cell = model.state.header.cellByKey(columnKey);
    if (cell) model.run("active-position.set", cell);
    const before = model.state;
    model.run("column-order.move", { columnKey, targetKey, side });
    const after = model.state;
    return describeMove(
        before.header.rows,
        after.header.rows,
        activeHeaderKey(after),
    );
}

describe("the column-reordering example's announcement", () => {
    it("names the moved column and where it went, as the grid shows it", () => {
        expect(announced("a", "b", "after")).toBe("Moved A after B.");
        expect(announced("b", "a", "before")).toBe("Moved B before A.");
        // a group, whole
        expect(announced("g", "a", "before")).toBe("Moved Group before A.");
        // two neighbours swapped: the active one moved, either way
        expect(announced("c", "d", "after")).toBe("Moved C after D.");
        expect(announced("d", "c", "before")).toBe("Moved D before C.");
    });

    it("follows the pinned split the grid keeps, whatever the order said before", () => {
        // the order lists the pinned ones last: the grid keeps them leading
        expect(announced("p", "q", "after", ["b", "a", "p", "q"])).toBe(
            "Moved P after Q.",
        );
        // after the last pinned one: the first of the others
        expect(announced("b", "q", "after")).toBe("Moved B before A.");
    });

    it("says nothing when nothing moved", () => {
        expect(announced("a", "q", "after")).toBeNull();
    });
});
