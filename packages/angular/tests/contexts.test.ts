import type { Signal } from "@angular/core";
import { describe, expectTypeOf, it } from "vitest";
import type {
    CellContext,
    HeaderRowContext,
    RowContext,
} from "../src/lib/context";
import type { DataGridCell } from "../src/lib/directives/cell.directive";
import type { DataGridHeaderCell } from "../src/lib/directives/header-cell.directive";
import type { DataGridHeaderRow } from "../src/lib/directives/header-row.directive";
import type { DataGridRow } from "../src/lib/directives/row.directive";

// These directives provide their context token (`DATA_GRID_CELL`, `DATA_GRID_ROW`,
// `DATA_GRID_HEADER_ROW`) with themselves, but cannot declare `implements` it: the members that
// make them one are `@internal`, stripped from the published declarations, which would then
// declare a class missing them. The type check (`pnpm typecheck`) proves they are one.
describe("the directives that provide a context", () => {
    it("are that context", () => {
        expectTypeOf<DataGridCell>().toExtend<CellContext>();
        expectTypeOf<DataGridHeaderCell>().toExtend<CellContext>();
        expectTypeOf<DataGridRow>().toExtend<RowContext>();
        expectTypeOf<DataGridHeaderRow>().toExtend<HeaderRowContext>();
        expectTypeOf<DataGridRow["rowInfo"]>().toExtend<Signal<unknown>>();
    });
});
