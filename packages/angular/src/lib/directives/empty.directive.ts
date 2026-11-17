import { Directive, inject, signal } from "@angular/core";
import {
    EMPTY_FILL,
    emptyAreaPropsOf,
    emptyCellPropsOf,
} from "@fragiola/data-grid";
import { DATA_GRID_TABLE, injectGrid } from "../context";
import { bindPart } from "../utils/helpers";
import { structuralView } from "../utils/structural";
import { elementOf } from "../utils/views";

/**
 * What the grid shows while it has no rows: its element, `<div *dataGridEmpty>No rows</div>`
 * (the app's content), in a row of its own, in an area below the header as large as the visible
 * body that stays in view when the grid scrolls sideways (the directive makes both). Nothing
 * renders while there are rows; it has no text or name of its own. Its element is the cell
 * (`role="gridcell"`, spanning every column): your class, style and content go on it. Place it
 * after the header. In a table grid (`<table dataGridGrid>`), or on a `<td>`, it is a table's
 * cell: its row and area are then a `<tr>` and a `<tbody>`.
 */
@Directive({ selector: "ng-template[dataGridEmpty]" })
export class DataGridEmpty {
    constructor() {
        const grid = injectGrid("*dataGridEmpty");
        const tableGrid = inject(DATA_GRID_TABLE, { optional: true });
        const area = signal<HTMLElement | null>(null);
        const row = signal<HTMLElement | null>(null);
        let table = false;
        const remove = () => {
            area()?.remove();
            area.set(null);
            row.set(null);
        };
        const cell = structuralView(
            () => (grid.view().rowCount === 0 ? {} : null),
            {
                place: (view) => {
                    // its area and row, made around its element, where the template is
                    const element = elementOf(view);
                    if (!element) return;
                    table =
                        (tableGrid?.table ?? false) || element.tagName === "TD";
                    const document = element.ownerDocument;
                    const areaElement = document.createElement(
                        table ? "tbody" : "div",
                    );
                    const rowElement = document.createElement(
                        table ? "tr" : "div",
                    );
                    element.before(areaElement);
                    areaElement.append(rowElement);
                    rowElement.append(...(view.rootNodes as Node[]));
                    area.set(areaElement);
                    row.set(rowElement);
                },
                clear: remove,
            },
        );
        const engine = () => grid.engine;
        bindPart(engine, cell, () => {
            const view = grid.view();
            const own = emptyCellPropsOf(view);
            // a table's cell spans the columns natively, in a table's row and row group; else
            // divs with roles. Mounted, its row counts in ARIA (`emptyShown`)
            return {
                props: table
                    ? {
                          ...own,
                          role: undefined,
                          "aria-colspan": undefined,
                          colSpan: Math.max(1, view.columnCount),
                          style: { ...own.style, ...EMPTY_FILL },
                      }
                    : own,
                layer: "empty",
            };
        });
        bindPart(engine, area, () => ({
            props: emptyAreaPropsOf(grid.view(), table).area,
        }));
        bindPart(engine, row, () => ({
            props: emptyAreaPropsOf(grid.view(), table).row,
        }));
    }
}
