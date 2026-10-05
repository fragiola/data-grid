// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import {
    type Column,
    DataGrid,
    type DetailHeight,
    type RowHeight,
    useDataGrid,
} from "../../src";

interface Note {
    id: string;
    text: string;
}

const columns: Column<Note>[] = [{ key: "text", width: 300 }];
declare const notes: Note[];

export function Notes() {
    const height: RowHeight = "auto";
    const detail: DetailHeight<Note> = "auto";
    return (
        <DataGrid.Root
            columns={columns}
            rows={notes}
            rowHeight={height}
            estimatedRowHeight={48}
            detailHeight={detail}
            estimatedDetailHeight={200}
        />
    );
}

export function WrongHeight() {
    return (
        <DataGrid.Root
            columns={columns}
            rows={notes}
            // @ts-expect-error: a height is a size, a function or "auto"
            rowHeight="fit"
        />
    );
}

export function WrongEstimate() {
    return (
        <DataGrid.Root
            columns={columns}
            rows={notes}
            // @ts-expect-error: an estimate is a size
            estimatedRowHeight="auto"
        />
    );
}

export function Sizes() {
    const { model, engine } = useDataGrid<Note>();
    const height: RowHeight = model.get("row-height");
    void height;
    const measured: boolean = engine.adapter.getView().measuredRows;
    void measured;
    model.run("sizes.set", {
        rowHeight: "auto",
        estimatedRowHeight: 40,
        detailHeight: "auto",
        estimatedDetailHeight: 120,
    });
    // @ts-expect-error: a detail's estimate is a size
    model.run("sizes.set", { estimatedDetailHeight: "auto" });
    return null;
}
