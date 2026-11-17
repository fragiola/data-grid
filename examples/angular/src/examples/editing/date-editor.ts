import { computed, Directive, input } from "@angular/core";
import type {
    DataGridNode,
    EditCellRenderProps,
} from "@fragiola/data-grid-angular";

// A date: the browser's date field, on the app's own (`<input kitInput type="date"
// exampleDateEditor [edit]="edit">`). Its look is its caller's.

@Directive({
    selector: "input[exampleDateEditor]",
    host: {
        "[attr.aria-label]": "edit().column.name ?? null",
        "[value]": "text()",
        "(input)": "onInput($event)",
    },
})
export class DateEditor<TRow> {
    readonly edit = input.required<EditCellRenderProps<TRow, DataGridNode>>();

    protected readonly text = computed(() => String(this.edit().value ?? ""));

    protected onInput(event: Event) {
        if (event.target instanceof HTMLInputElement) {
            this.edit().onChange(event.target.value);
        }
    }
}
