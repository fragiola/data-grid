// Vue port of the Fragiola UI avatar (examples/react/src/components/ui/avatar.tsx): the same parts,
// classes and palette roles, over Reka UI's Avatar (the same loading states: the fallback shows
// until the image loads).

import {
    AvatarFallback as AvatarFallbackPrimitive,
    AvatarImage as AvatarImagePrimitive,
    AvatarRoot as AvatarRootPrimitive,
} from "reka-ui";
import { defineComponent, h } from "vue";
import { cn } from "#/lib/cn";

const AvatarRoot = defineComponent({
    name: "AvatarRoot",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                AvatarRootPrimitive,
                {
                    "data-slot": "avatar",
                    ...attrs,
                    class: cn(
                        "relative flex size-10 shrink-0 overflow-hidden rounded-full",
                        attrs.class as string,
                    ),
                },
                slots,
            );
    },
});

const AvatarImage = defineComponent({
    name: "AvatarImage",
    inheritAttrs: false,
    props: { src: { type: String, required: true } },
    setup(props, { attrs, slots }) {
        return () =>
            h(
                AvatarImagePrimitive,
                {
                    "data-slot": "avatar-image",
                    ...attrs,
                    src: props.src,
                    class: cn(
                        "aspect-square size-full object-cover",
                        "data-[starting-style]:animate-in data-[starting-style]:fade-in-0",
                        attrs.class as string,
                    ),
                },
                slots,
            );
    },
});

const AvatarFallback = defineComponent({
    name: "AvatarFallback",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                AvatarFallbackPrimitive,
                {
                    "data-slot": "avatar-fallback",
                    ...attrs,
                    class: cn(
                        "absolute inset-0 flex size-full items-center justify-center rounded-full bg-palette-soft text-sm font-medium text-palette-contrast",
                        attrs.class as string,
                    ),
                },
                slots,
            );
    },
});

export const Avatar = {
    Root: AvatarRoot,
    Image: AvatarImage,
    Fallback: AvatarFallback,
};
