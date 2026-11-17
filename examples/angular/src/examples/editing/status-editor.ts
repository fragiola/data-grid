import {
    ChangeDetectionStrategy,
    Component,
    Directive,
    ElementRef,
    inject,
    input,
    type OnInit,
} from "@angular/core";
import type {
    DataGridNode,
    EditCellRenderProps,
} from "@fragiola/data-grid-angular";
import { SELECT_PARTS } from "#/components/ui/select";
import { isStatus } from "../_kit/budgeted-tasks";
import { STATUSES } from "../_kit/tasks";

// A status: a select, open as the edit starts; choosing one commits it. Its list opens in the
// page's body, out of the grid: marked as the edit's (`editorProps`), a press or focus there keeps
// it open. Its look is its caller's (`class`, on the trigger).

const STATUS_ITEMS = Object.fromEntries(
    STATUSES.map((status) => [status, status]),
);

/** The edit's `editorProps` written on the element as its attributes (React spreads them). */
@Directive({ selector: "[exampleEditorProps]" })
export class EditorProps implements OnInit {
    readonly exampleEditorProps =
        input.required<Readonly<Record<string, string>>>();
    private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

    // before the list takes the focus (it does on the next microtask)
    ngOnInit() {
        for (const [name, value] of Object.entries(this.exampleEditorProps())) {
            this.element.nativeElement.setAttribute(name, value);
        }
    }
}

@Component({
    selector: "example-status-editor",
    imports: [SELECT_PARTS, EditorProps],
    changeDetection: ChangeDetectionStrategy.OnPush,
    // the trigger is the cell's content, as if this element were not there
    host: { style: "display: contents" },
    template: `
        <button
            [kitSelectTrigger]="list"
            [items]="items"
            [value]="edit().value"
            (valueChange)="choose($event)"
            defaultOpen
            [attr.aria-label]="edit().column.name"
            [class]="class()"
        >
            <span kitSelectValue></span>
        </button>
        <ng-template #list>
            <div kitSelectContent [exampleEditorProps]="edit().editorProps">
                @for (status of statuses; track status) {
                    <div [kitSelectItem]="status">{{ status }}</div>
                }
            </div>
        </ng-template>
    `,
})
export class StatusEditor<TRow> {
    readonly edit = input.required<EditCellRenderProps<TRow, DataGridNode>>();
    readonly class = input<string>();
    protected readonly items = STATUS_ITEMS;
    protected readonly statuses = STATUSES;

    protected choose(status: unknown) {
        if (isStatus(status)) this.edit().onCommit(status);
    }
}
