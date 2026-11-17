import { computed, Directive, effect, input, untracked } from "@angular/core";
import type {
    DataGridNode,
    EditCellRenderProps,
} from "@fragiola/data-grid-angular";

// A text editor: on the app's own field (`<input kitInput exampleTextEditor [edit]="edit">`, its
// look its caller's), given the draft and the way to change it. An edit typing started starts
// from the key typed, as a spreadsheet does.

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
    // the key that started the edit, once: a new draft is no new key
    private readonly startKey = computed(() => this.edit().startKey);

    constructor() {
        effect(() => {
            const key = this.startKey();
            if (key !== undefined) untracked(() => this.edit().onChange(key));
        });
    }

    protected onInput(event: Event) {
        if (event.target instanceof HTMLInputElement) {
            this.edit().onChange(event.target.value);
        }
    }
}
