// Type fixtures, checked by `ngc` (strict templates), never run: the template directives'
// contexts are typed by the row type of what they are given (the columns, or the root), and a
// column renderer's template by its context. `@ts-expect-error` marks what must not compile.
import { Component, type TemplateRef, viewChild } from "@angular/core";
import {
    type CellsContext,
    type CellTemplateProps,
    type Column,
    contextOf,
    DATA_GRID,
    DataGridCells,
    type DataGridNode,
    DataGridRows,
    DataGridTemplate,
    type RowsContext,
    type TemplateContext,
    templateContent,
} from "../../src/public-api";

interface Person {
    id: number;
    name: string;
}

declare const context: unknown;

// the context guard narrows a template's context to the row type of its directive
declare const rows: DataGridRows<Person>;
if (DataGridRows.ngTemplateContextGuard(rows, context)) {
    const typed: RowsContext<Person> = context;
    const name: string | undefined = typed.row.row?.name;
    void name;
    // @ts-expect-error a person has no age
    void typed.$implicit.row?.age;
}

declare const cells: DataGridCells<Person>;
if (DataGridCells.ngTemplateContextGuard(cells, context)) {
    const typed: CellsContext<Person> = context;
    const id: number | undefined = typed.cell.row?.id;
    void id;
    // @ts-expect-error a cell's row is a person
    const wrong: string | undefined = typed.cell.row?.id;
    void wrong;
}

declare const template: DataGridTemplate<CellTemplateProps<Person>>;
if (DataGridTemplate.ngTemplateContextGuard(template, context)) {
    const typed: TemplateContext<CellTemplateProps<Person>> = context;
    const name: string = typed.row.name;
    const same: string = typed.$implicit.row.name;
    void name;
    void same;
}

// a renderer returns its template with the context the template takes
declare const nameCell: TemplateRef<TemplateContext<CellTemplateProps<Person>>>;
const column: Column<Person, DataGridNode> = {
    key: "name",
    width: 100,
    renderCell: (props) => templateContent(nameCell, props),
};
void column;
const wrongColumn: Column<Person, DataGridNode> = {
    key: "name",
    width: 100,
    // @ts-expect-error the template takes a cell's props, not a number
    renderCell: () => templateContent(nameCell, 1),
};
void wrongColumn;

// in a template (strict templates): the row and the cell are typed by the columns given
@Component({
    selector: "typed-grid",
    imports: [DATA_GRID],
    template: `
        <ng-template #nameCell [dataGridTemplate]="nameContext" let-row="row">
            {{ row.name.toUpperCase() }}
        </ng-template>
        <div dataGridRoot [rows]="people" [columns]="columns">
            <div dataGridGrid>
                <div dataGridBody>
                    <ng-template [dataGridRows]="columns" let-row>
                        <div [dataGridRow]="row" [attr.data-id]="row.row?.id">
                            <ng-template [dataGridCells]="columns" let-cell>
                                <div [dataGridCell]="cell">{{ cell.row?.name }}</div>
                            </ng-template>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export class TypedGrid {
    readonly people: Person[] = [];
    readonly nameContext = contextOf<CellTemplateProps<Person>>();
    readonly nameCell =
        viewChild.required<
            TemplateRef<TemplateContext<CellTemplateProps<Person>>>
        >("nameCell");
    readonly columns: Column<Person, DataGridNode>[] = [
        {
            key: "name",
            width: 100,
            renderCell: (props) => templateContent(this.nameCell(), props),
        },
    ];
}
