import { Directive, input } from "@angular/core";
import type { ContextOf, TemplateContext } from "../utils/content";

/**
 * Types a column renderer's template by its context: `<ng-template #nameCell
 * [dataGridTemplate]="nameCellContext" let-row="row">`, where `nameCellContext =
 * contextOf<CellTemplateProps<Person>>()`. The renderer returns it with its context:
 * `renderCell: (props) => templateContent(this.nameCell(), props)`. It renders nothing itself.
 */
@Directive({ selector: "ng-template[dataGridTemplate]" })
export class DataGridTemplate<C extends object> {
    /** the context type (`contextOf<…>()`) */
    readonly dataGridTemplate = input.required<ContextOf<C>>();

    static ngTemplateContextGuard<C extends object>(
        _directive: DataGridTemplate<C>,
        _context: unknown,
    ): _context is TemplateContext<C> {
        return true;
    }
}
