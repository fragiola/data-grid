import { computed, Directive, input } from "@angular/core";
import type {
    DataGridNode,
    EditCellRenderProps,
} from "@fragiola/data-grid-angular";
import { injectStartKey } from "./inject-start-key";

// A text field: on the app's own field (`<input kitInput exampleTextEditor [edit]="edit">`), given
// the edit, its draft and the ways to change, commit and cancel it. Its look is its caller's.

@Directive({
    selector: "input[exampleTextEditor]",
    host: {
        "[attr.aria-label]": "edit().column.name ?? null",
        "[value]": "text()",
        "(input)": "onInput($event)",
    },
})
export class TextEditor<TRow> {
    readonly edit = input.required<EditCellRenderProps<TRow, DataGridNode>>();

    protected readonly text = computed(() => String(this.edit().value ?? ""));

    constructor() {
        injectStartKey(
            () => this.edit().startKey,
            (value) => this.edit().onChange(value),
        );
    }

    protected onInput(event: Event) {
        if (event.target instanceof HTMLInputElement) {
            this.edit().onChange(event.target.value);
        }
    }
}
