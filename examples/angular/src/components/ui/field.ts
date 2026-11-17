// Angular port of the Fragiola UI field (examples/react/src/components/ui/field.tsx): the same
// parts, classes and palette roles (the `field` family), as directives on native elements. Base
// UI's Field links the label, the control and the description by id; here the root makes one id,
// the label points at it (`for`) and `kitInput` takes it.

import {
    computed,
    DestroyRef,
    Directive,
    inject,
    input,
    signal,
} from "@angular/core";
import { TEXT } from "#/components/atoms/text";
import { field } from "#/components/families/field";
import { cn } from "#/lib/cn";

let nextId = 0;

/** A field: label, row, description and error, sharing the control's id. */
@Directive({
    selector: "[kitFieldRoot]",
    host: { "data-slot": "field-root", "[class]": "classes()" },
})
export class FieldRoot {
    readonly class = input<string>();
    /** The id of the field's control. */
    readonly controlId = `kit-field-${++nextId}`;
    /** The ids of the description and the error shown, which describe the control. */
    readonly describedBy = signal<readonly string[]>([]);
    /** Whether an error is shown. */
    readonly invalid = computed(() =>
        this.describedBy().some((id) => id.endsWith("-error")),
    );

    /** Registers a description or error while it is rendered. */
    describe(id: string) {
        this.describedBy.update((ids) => [...ids, id]);
        return () =>
            this.describedBy.update((ids) =>
                ids.filter((other) => other !== id),
            );
    }
    protected readonly classes = computed(() => cn(field.root(), this.class()));
}

@Directive({
    selector: "label[kitFieldLabel]",
    host: {
        "data-slot": "field-label",
        "[attr.for]": "root?.controlId ?? null",
        "[class]": "classes()",
    },
})
export class FieldLabel {
    readonly class = input<string>();
    protected readonly root = inject(FieldRoot, { optional: true });
    protected readonly classes = computed(() =>
        cn(TEXT.label, field.label(), this.class()),
    );
}

@Directive({
    selector: "[kitFieldRow]",
    host: { "data-slot": "field-row", "[class]": "classes()" },
})
export class FieldRow {
    readonly class = input<string>();
    protected readonly classes = computed(() => cn(field.row(), this.class()));
}

@Directive({
    selector: "[kitFieldBody]",
    host: { "data-slot": "field-body", "[class]": "classes()" },
})
export class FieldBody {
    readonly class = input<string>();
    protected readonly classes = computed(() => cn(field.body(), this.class()));
}

@Directive({
    selector: "[kitFieldAddon]",
    host: {
        "data-slot": "field-addon",
        "[attr.data-side]": "side()",
        "[class]": "classes()",
    },
})
export class FieldAddon {
    readonly side = input<
        "inline-start" | "inline-end" | "block-start" | "block-end"
    >("inline-end");
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(field.addon(), this.class()),
    );
}

/** Registers an element's id with its field (it describes the control while it is rendered). */
function describes(kind: "description" | "error") {
    const id = `kit-field-${kind}-${++nextId}-${kind}`;
    const root = inject(FieldRoot, { optional: true });
    const remove = root?.describe(id);
    if (remove) inject(DestroyRef).onDestroy(remove);
    return id;
}

@Directive({
    selector: "[kitFieldDescription]",
    host: {
        "data-slot": "field-description",
        "[id]": "id",
        "[class]": "classes()",
    },
})
export class FieldDescription {
    protected readonly id = describes("description");
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(TEXT.paragraph, field.description(), this.class()),
    );
}

@Directive({
    selector: "[kitFieldError]",
    host: { "data-slot": "field-error", "[id]": "id", "[class]": "classes()" },
})
export class FieldError {
    protected readonly id = describes("error");
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(TEXT.error, field.error(), this.class()),
    );
}

/** Every part of a field, for a component's `imports`. */
export const FIELD = [
    FieldRoot,
    FieldLabel,
    FieldRow,
    FieldBody,
    FieldAddon,
    FieldDescription,
    FieldError,
] as const;
