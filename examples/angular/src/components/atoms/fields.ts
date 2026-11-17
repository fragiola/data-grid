// Angular port of the Fragiola UI field atoms and the input's simple template
// (examples/react/src/components/atoms/fields): the same classes and palette roles (the `field`
// family) on native controls. `input[kitInput]`, `input[kitNumeric]` (a number input whose arrow
// keys step within `min`/`max`) and `textarea[kitTextarea]` are bare controls on your own
// elements; `<kit-input-simple>` is a whole field: label, row, input, description and error, linked
// by id.
//
//     <kit-input-simple ariaLabel="Search" placeholder="Search" [value]="search()"
//         (valueChange)="search.set($event)">
//         <svg kitInset="start" lucideSearch></svg>
//     </kit-input-simple>
//
// What differs from the React one, and why:
//   - React forwards every input prop through `...props`; an Angular component's attributes stay
//     on its host, so the template takes the input's own as inputs (`type`, `name`,
//     `placeholder`, `inputmode`, `ariaLabel`, `value`) and tells each typed value with
//     `(valueChange)` (Base UI's `onValueChange`).
//   - `inset` is content: an element marked `kitInset="start"` or `kitInset="end"` goes inside the
//     body, before or after the input (React's `inset={{ start, end }}`).
//   - `value` is bound to the input's `value` property only when it changes, so what is typed
//     stays while it is the value given back.

import {
    booleanAttribute,
    Component,
    computed,
    contentChildren,
    Directive,
    inject,
    input,
    numberAttribute,
    output,
} from "@angular/core";
import { field } from "#/components/families/field";
import { FIELD, FieldRoot } from "#/components/ui/field";
import { cn } from "#/lib/cn";

/** What every bare control takes from the field around it: the id, the description, the error. */
const CONTROL_HOST = {
    "[attr.id]": "root?.controlId ?? null",
    "[attr.aria-describedby]": "root?.describedBy()?.join(' ') || null",
    "[attr.aria-invalid]": "root?.invalid() ? 'true' : null",
};

/** A native input with the field family's control classes, named by its field's label. */
@Directive({
    selector: "input[kitInput]",
    host: { "data-slot": "input", ...CONTROL_HOST, "[class]": "classes()" },
})
export class Input {
    readonly class = input<string>();
    protected readonly root = inject(FieldRoot, { optional: true });
    protected readonly classes = computed(() =>
        cn(field.control(), this.class()),
    );
}

/** A number input whose arrow keys step the value, clamped to `min` and `max`. */
@Directive({
    selector: "input[kitNumeric]",
    host: {
        "data-slot": "numeric",
        type: "number",
        ...CONTROL_HOST,
        "[attr.min]": "min() ?? null",
        "[attr.max]": "max() ?? null",
        "[attr.step]": "step()",
        "[class]": "classes()",
        "(keydown)": "onKeydown($event)",
    },
})
export class Numeric {
    readonly min = input<number | undefined, unknown>(undefined, {
        transform: optionalNumber,
    });
    readonly max = input<number | undefined, unknown>(undefined, {
        transform: optionalNumber,
    });
    readonly step = input(1, { transform: numberAttribute });
    readonly class = input<string>();
    protected readonly root = inject(FieldRoot, { optional: true });
    protected readonly classes = computed(() =>
        cn(field.control(), this.class()),
    );

    protected onKeydown(event: KeyboardEvent) {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        const control = event.currentTarget as HTMLInputElement;
        const base = Number.parseFloat(control.value);
        const current = Number.isFinite(base) ? base : 0;
        const next = current + (event.key === "ArrowUp" ? 1 : -1) * this.step();
        const min = this.min();
        const max = this.max();
        const clamped =
            min !== undefined && next < min
                ? min
                : max !== undefined && next > max
                  ? max
                  : next;
        control.value = String(clamped);
    }
}

function optionalNumber(value: unknown) {
    return value === undefined || value === null || value === ""
        ? undefined
        : numberAttribute(value);
}

/** A native textarea with the field family's control classes. */
@Directive({
    selector: "textarea[kitTextarea]",
    host: { "data-slot": "textarea", ...CONTROL_HOST, "[class]": "classes()" },
})
export class Textarea {
    readonly class = input<string>();
    protected readonly root = inject(FieldRoot, { optional: true });
    protected readonly classes = computed(() =>
        cn(field.control(), "min-h-control", this.class()),
    );
}

/** Marks content of `<kit-input-simple>` that goes inside its body, on a side of the input. */
@Directive({ selector: "[kitInset]" })
export class InputInset {
    readonly kitInset = input.required<"start" | "end">();
}

@Component({
    selector: "kit-input-simple",
    imports: [FIELD, Input],
    host: { class: "contents" },
    template: `
        <div kitFieldRoot>
            @if (label()) {
                <label kitFieldLabel
                    >{{ label() }}@if (required()) {<span aria-hidden="true">*</span>}</label
                >
            }
            <div kitFieldRow>
                <div kitFieldBody [class]="class()">
                    @if (hasInset("start")) {
                        <span [class]="inset"><ng-content select="[kitInset=start]" /></span>
                    }
                    <input
                        kitInput
                        [attr.type]="type()"
                        [attr.name]="name() ?? null"
                        [attr.placeholder]="placeholder() ?? null"
                        [attr.inputmode]="inputmode() ?? null"
                        [attr.aria-label]="ariaLabel() ?? null"
                        [value]="value() ?? ''"
                        [required]="required()"
                        (input)="valueChange.emit($any($event.target).value)"
                    />
                    @if (hasInset("end")) {
                        <span [class]="inset"><ng-content select="[kitInset=end]" /></span>
                    }
                </div>
            </div>
            @if (description()) {
                <p kitFieldDescription>{{ description() }}</p>
            }
            @if (error()) {
                <span kitFieldError>{{ error() }}</span>
            }
        </div>
    `,
})
export class InputSimple {
    readonly label = input<string>();
    readonly description = input<string>();
    readonly error = input<string>();
    readonly required = input(false, { transform: booleanAttribute });
    readonly type = input("text");
    readonly name = input<string>();
    readonly placeholder = input<string>();
    readonly inputmode = input<string>();
    /**
     * The input's accessible name when there is no label (`ariaLabel="Search"`: an `aria-label`
     * attribute would stay on the host too, naming it as well).
     */
    readonly ariaLabel = input<string>();
    /** The input's value: what it shows, given back as it is typed. */
    readonly value = input<string>();
    /** Each value typed (Base UI's `onValueChange`). */
    readonly valueChange = output<string>();
    /** Classes of the field's body (React's `className`: the palette channel). */
    readonly class = input<string>();
    protected readonly inset = field.inset();
    private readonly insets = contentChildren(InputInset);

    protected hasInset(side: "start" | "end") {
        return this.insets().some((inset) => inset.kitInset() === side);
    }
}

/** The input atoms, for a component's `imports`. */
export const FIELDS = [
    Input,
    Numeric,
    Textarea,
    InputSimple,
    InputInset,
] as const;
