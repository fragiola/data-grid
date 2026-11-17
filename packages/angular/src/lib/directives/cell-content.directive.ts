import { Directive, inject } from "@angular/core";
import { DATA_GRID_CELL } from "../context";
import { renderNode } from "../utils/render-node";

/**
 * A cell's default content, where it is placed: `<ng-container *dataGridCellContent />` inside a
 * `[dataGridCell]` (its column's `renderCell` for a loaded row, else its value as text; on a group
 * row its `renderGroupCell`; edited, its `renderEditCell`, given the draft), a
 * `[dataGridHeaderCell]` (the group's or the column's `renderHeaderCell`, else its `name`) or a
 * `[dataGridSummaryCell]` (its column's `renderSummaryCell`, else nothing). A renderer's template
 * renders with the context it returned (`templateContent`).
 */
@Directive({ selector: "ng-template[dataGridCellContent]" })
export class DataGridCellContent {
    constructor() {
        const cell = inject(DATA_GRID_CELL, { optional: true });
        if (!cell) {
            throw new Error(
                "*dataGridCellContent must be used inside [dataGridCell], [dataGridHeaderCell] or [dataGridSummaryCell]",
            );
        }
        renderNode(cell.content);
    }
}
