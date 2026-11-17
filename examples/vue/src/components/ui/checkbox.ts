// Vue port of the Fragiola UI checkbox (examples/react/src/components/ui/checkbox.tsx): the same
// parts, classes and palette roles, over Reka UI's Checkbox.
//
// What differs from the React one, and why:
//   - Base UI marks the state with `data-checked`/`data-unchecked`/`data-indeterminate`; Reka UI
//     with `data-state`. The root adds Base UI's attributes, so the classes are the React ones.
//   - `checked` and `indeterminate` are props, as Base UI takes them; a change is
//     `@checked-change="(checked, { event }) => …"`, as Base UI's `onCheckedChange(checked,
//     details)`: the event tells a Shift+click (a range) from a click.

import { CheckIcon } from "@lucide/vue";
import {
    CheckboxIndicator as CheckboxIndicatorPrimitive,
    CheckboxRoot as CheckboxRootPrimitive,
} from "reka-ui";
import { defineComponent, h, mergeProps } from "vue";
import { cn } from "#/lib/cn";

/** What a change carries besides the new state: the click (or key) that made it. */
export interface CheckedChangeDetails {
    event: Event;
}

const CheckboxRoot = defineComponent({
    name: "CheckboxRoot",
    inheritAttrs: false,
    props: {
        checked: { type: Boolean, default: false },
        indeterminate: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
    },
    emits: {
        checkedChange: (_checked: boolean, _details: CheckedChangeDetails) =>
            true,
    },
    setup(props, { attrs, slots, emit }) {
        // the click that is toggling the box: Reka UI tells the new state without it
        let pressed: Event | undefined;
        return () => {
            const state = props.indeterminate ? "indeterminate" : props.checked;
            return h(
                CheckboxRootPrimitive,
                // the consumer's listeners merged with the box's own, never replaced
                mergeProps(attrs, {
                    "data-slot": "checkbox",
                    modelValue: state,
                    disabled: props.disabled,
                    "data-checked": state === true ? "" : undefined,
                    "data-unchecked": state === false ? "" : undefined,
                    "data-indeterminate":
                        state === "indeterminate" ? "" : undefined,
                    onClickCapture: (event: Event) => {
                        pressed = event;
                    },
                    "onUpdate:modelValue": (value: unknown) => {
                        const event = pressed ?? new Event("change");
                        pressed = undefined;
                        emit("checkedChange", value === true, { event });
                    },
                    class: cn(
                        "field-control size-4 shrink-0 rounded-sm border",
                        "border-palette-line bg-palette-soft",
                        "data-checked:bg-palette-ring data-checked:border-palette-line data-checked:text-palette-base",
                        "field-focus:outline-solid field-focus:outline-1 field-focus:outline-offset-1 field-focus:outline-palette-ring",
                        "data-disabled:opacity-50 data-disabled:cursor-not-allowed",
                        "transition-colors",
                        attrs.class as string,
                    ),
                }),
                slots,
            );
        };
    },
});

const CheckboxIndicator = defineComponent({
    name: "CheckboxIndicator",
    inheritAttrs: false,
    setup(_, { attrs }) {
        return () =>
            h(
                CheckboxIndicatorPrimitive,
                {
                    "data-slot": "checkbox-indicator",
                    ...attrs,
                    class: cn(
                        "grid place-content-center text-current",
                        attrs.class as string,
                    ),
                },
                { default: () => h(CheckIcon, { class: "size-3.5" }) },
            );
    },
});

export const Checkbox = {
    Root: CheckboxRoot,
    Indicator: CheckboxIndicator,
};
