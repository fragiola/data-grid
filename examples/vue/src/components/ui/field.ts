// Vue port of the Fragiola UI field (examples/react/src/components/ui/field.tsx): the same parts,
// classes and palette roles (the `field` family). Base UI's Field links the label, the control and
// the description by id; here the root provides one id, the label points at it (`for`) and
// `Input` takes it, with native elements (Reka UI has no field primitive).

import {
    defineComponent,
    h,
    type InjectionKey,
    inject,
    type PropType,
    provide,
    useId,
} from "vue";
import { Text } from "#/components/atoms/text";
import { field } from "#/components/families/field";
import { cn } from "#/lib/cn";

/** The id of the control of the enclosing `Field.Root`. */
export const FIELD_CONTROL_ID: InjectionKey<string> =
    Symbol("field-control-id");

function box(name: string, slot: string, classes: () => string, root = false) {
    return defineComponent({
        name,
        inheritAttrs: false,
        setup(_, { attrs, slots }) {
            if (root) provide(FIELD_CONTROL_ID, useId());
            return () =>
                h(
                    "div",
                    {
                        "data-slot": slot,
                        ...attrs,
                        class: cn(classes(), attrs.class as string),
                    },
                    slots.default?.(),
                );
        },
    });
}

const FieldLabel = defineComponent({
    name: "FieldLabel",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        const id = inject(FIELD_CONTROL_ID, undefined);
        return () =>
            h(
                Text.Label,
                {
                    "data-slot": "field-label",
                    for: id,
                    ...attrs,
                    class: cn(field.label(), attrs.class as string),
                },
                slots,
            );
    },
});

const FieldAddon = defineComponent({
    name: "FieldAddon",
    inheritAttrs: false,
    props: {
        side: {
            type: String as PropType<
                "inline-start" | "inline-end" | "block-start" | "block-end"
            >,
            default: "inline-end",
        },
    },
    setup(props, { attrs, slots }) {
        return () =>
            h(
                "div",
                {
                    "data-slot": "field-addon",
                    "data-side": props.side,
                    ...attrs,
                    class: cn(field.addon(), attrs.class as string),
                },
                slots.default?.(),
            );
    },
});

function text(
    name: string,
    slot: string,
    atom: typeof Text.Paragraph,
    classes: () => string,
) {
    return defineComponent({
        name,
        inheritAttrs: false,
        setup(_, { attrs, slots }) {
            return () =>
                h(
                    atom,
                    {
                        "data-slot": slot,
                        ...attrs,
                        class: cn(classes(), attrs.class as string),
                    },
                    slots,
                );
        },
    });
}

export const Field = {
    Root: box("FieldRoot", "field-root", () => field.root(), true),
    ChoiceRoot: box(
        "FieldChoiceRoot",
        "field-choice-root",
        () => field.choiceRoot(),
        true,
    ),
    Label: FieldLabel,
    Row: box("FieldRow", "field-row", () => field.row()),
    Body: box("FieldBody", "field-body", () => field.body()),
    Inset: box("FieldInset", "field-inset", () => field.inset()),
    Addon: FieldAddon,
    Description: text(
        "FieldDescription",
        "field-description",
        Text.Paragraph,
        () => field.description(),
    ),
    Error: text("FieldError", "field-error", Text.Error, () => field.error()),
};
