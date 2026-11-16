// Vue port of the Fragiola UI switch (examples/react/src/components/ui/switch.tsx): the same parts,
// classes and palette roles, over Reka UI's Switch (`v-model` is its checked state, as Base UI's
// `checked`/`onCheckedChange`). Base UI marks the checked state with `data-checked`, Reka UI with
// `data-state`: both parts add Base UI's attribute, so the classes are the React ones.

import {
    injectSwitchRootContext,
    SwitchRoot as SwitchRootPrimitive,
    SwitchThumb as SwitchThumbPrimitive,
} from "reka-ui";
import { computed, defineComponent, h, ref } from "vue";
import { cn } from "#/lib/cn";

const SwitchRoot = defineComponent({
    name: "SwitchRoot",
    inheritAttrs: false,
    props: {
        modelValue: { type: Boolean, default: undefined },
        defaultValue: { type: Boolean, default: false },
    },
    emits: { "update:modelValue": (_value: boolean) => true },
    setup(props, { attrs, slots, emit }) {
        // the state the root shows: the bound value, or its own when nothing is bound
        const own = ref(props.defaultValue);
        const checked = computed(() => props.modelValue ?? own.value);
        return () =>
            h(
                SwitchRootPrimitive,
                {
                    "data-slot": "switch",
                    ...attrs,
                    modelValue: checked.value,
                    "onUpdate:modelValue": (value: unknown) => {
                        own.value = value === true;
                        emit("update:modelValue", value === true);
                    },
                    "data-checked": checked.value ? "" : undefined,
                    class: cn(
                        "field-control inline-flex shrink-0 items-center rounded-full border border-transparent",
                        "w-8 h-5 p-0.5",
                        "bg-palette-soft data-checked:bg-palette-ring",
                        "field-focus:outline-solid field-focus:outline-1 field-focus:outline-offset-1 field-focus:outline-palette-ring",
                        "data-disabled:opacity-50 data-disabled:cursor-not-allowed",
                        "transition-colors",
                        attrs.class as string,
                    ),
                },
                slots,
            );
    },
});

const SwitchThumb = defineComponent({
    name: "SwitchThumb",
    inheritAttrs: false,
    setup(_, { attrs }) {
        const root = injectSwitchRootContext();
        return () =>
            h(SwitchThumbPrimitive, {
                "data-slot": "switch-thumb",
                "data-checked": root.checked.value ? "" : undefined,
                ...attrs,
                class: cn(
                    "block size-4 rounded-full bg-palette-ring transition-transform data-checked:translate-x-3 data-checked:bg-palette-base",
                    attrs.class as string,
                ),
            });
    },
});

export const Switch = {
    Root: SwitchRoot,
    Thumb: SwitchThumb,
};
