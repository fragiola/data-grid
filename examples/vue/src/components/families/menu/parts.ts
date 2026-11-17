// Vue port of the Fragiola UI menu parts (examples/react/src/components/families/menu/parts.tsx):
// the parts a dropdown menu and a context menu share, made once from the primitives of either
// (Reka UI's DropdownMenu* or ContextMenu*), with the `menu` and `popup` families' classes.
//
// Base UI marks an open popup with `data-open`/`data-closed`; Reka UI with `data-state`. The
// content adds Base UI's attributes, so the families' variants apply unchanged. The content
// teleports to the body of its trigger's document (popout windows).

import { CheckIcon, ChevronRightIcon } from "@lucide/vue";
import {
    type Component,
    defineComponent,
    h,
    type PropType,
    type Ref,
} from "vue";
import { useOwnerBody } from "#/hooks/use-owner-body";
import { cn } from "#/lib/cn";
import { menu } from "../menu";
import { popup } from "../popup";

/** The Reka UI primitives a menu is made of. */
export type MenuPrimitives = {
    Item: Component;
    CheckboxItem: Component;
    ItemIndicator: Component;
    RadioGroup: Component;
    RadioItem: Component;
    Group: Component;
    Label: Component;
    Separator: Component;
    Sub: Component;
    SubTrigger: Component;
    SubContent: Component;
    Portal: Component;
    Content: Component;
};

/** What the content reads from the menu's root context. */
export type MenuRoot = () => {
    open: Readonly<Ref<boolean>>;
    triggerElement: Ref<HTMLElement | undefined>;
};

type Side = "top" | "right" | "bottom" | "left";
type Align = "start" | "center" | "end";

const inset = { inset: { type: Boolean, default: false } };

/** A part that renders `primitive` with its data-slot and its family classes. */
function part(name: string, primitive: Component, slot: string, classes = "") {
    return defineComponent({
        name,
        inheritAttrs: false,
        props: inset,
        setup(props, { attrs, slots }) {
            return () =>
                h(
                    primitive,
                    {
                        "data-slot": slot,
                        "data-inset": props.inset ? "" : undefined,
                        ...attrs,
                        class: cn(classes, attrs.class as string),
                    },
                    slots,
                );
        },
    });
}

/** A checkable item: the check sits in the indicator space on the end side. */
function checkable(name: string, primitive: Component, P: MenuPrimitives) {
    return defineComponent({
        name,
        inheritAttrs: false,
        props: inset,
        setup(props, { attrs, slots }) {
            return () =>
                h(
                    primitive,
                    {
                        "data-slot": "menu-item",
                        "data-inset": props.inset ? "" : undefined,
                        ...attrs,
                        class: cn(menu.selectableItem(), attrs.class as string),
                    },
                    {
                        default: () => [
                            h(
                                "span",
                                {
                                    class: menu.itemIndicator(),
                                    "data-slot": "menu-item-indicator",
                                },
                                [
                                    h(P.ItemIndicator, null, {
                                        default: () => h(CheckIcon),
                                    }),
                                ],
                            ),
                            slots.default?.(),
                        ],
                    },
                );
        },
    });
}

export function createMenuParts(P: MenuPrimitives, useRoot: MenuRoot) {
    const Content = defineComponent({
        name: "MenuContent",
        inheritAttrs: false,
        props: {
            align: { type: String as PropType<Align>, default: undefined },
            alignOffset: { type: Number, default: undefined },
            side: { type: String as PropType<Side>, default: undefined },
            sideOffset: { type: Number, default: undefined },
            /** Which primitive renders the list: the menu's content, or a submenu's. */
            sub: { type: Boolean, default: false },
        },
        setup(props, { attrs, slots }) {
            const root = useRoot();
            const to = useOwnerBody(() => root.triggerElement.value, root.open);
            return () =>
                h(
                    P.Portal,
                    { to: to.value },
                    {
                        default: () =>
                            h(
                                props.sub ? P.SubContent : P.Content,
                                {
                                    "data-slot": "menu-content",
                                    ...(props.sub
                                        ? { sideOffset: props.sideOffset }
                                        : {
                                              align: props.align,
                                              alignOffset: props.alignOffset,
                                              side: props.side,
                                              sideOffset: props.sideOffset,
                                          }),
                                    "data-open": root.open.value
                                        ? ""
                                        : undefined,
                                    "data-closed": root.open.value
                                        ? undefined
                                        : "",
                                    ...attrs,
                                    class: cn(
                                        popup.content("z-50 outline-none"),
                                        attrs.class as string,
                                    ),
                                },
                                slots,
                            ),
                    },
                );
        },
    });

    const SubTrigger = defineComponent({
        name: "MenuSubTrigger",
        inheritAttrs: false,
        props: inset,
        setup(props, { attrs, slots }) {
            return () =>
                h(
                    P.SubTrigger,
                    {
                        "data-slot": "menu-sub-trigger",
                        "data-inset": props.inset ? "" : undefined,
                        ...attrs,
                        class: cn(menu.subTrigger(), attrs.class as string),
                    },
                    {
                        default: () => [
                            slots.default?.(),
                            h(ChevronRightIcon, {
                                class: "ms-auto rtl:rotate-180",
                            }),
                        ],
                    },
                );
        },
    });

    const SubContent = defineComponent({
        name: "MenuSubContent",
        inheritAttrs: false,
        setup(_, { attrs, slots }) {
            return () =>
                h(
                    Content,
                    { "data-slot": "menu-sub-content", sub: true, ...attrs },
                    slots,
                );
        },
    });

    const Shortcut = defineComponent({
        name: "MenuShortcut",
        inheritAttrs: false,
        setup(_, { attrs, slots }) {
            return () =>
                h(
                    "span",
                    {
                        "data-slot": "menu-shortcut",
                        ...attrs,
                        class: cn(menu.shortcut(), attrs.class as string),
                    },
                    slots.default?.(),
                );
        },
    });

    return {
        Sub: P.Sub,
        Item: part("MenuItem", P.Item, "menu-item", menu.item()),
        SelectableItem: part(
            "MenuSelectableItem",
            P.Item,
            "menu-item",
            menu.selectableItem(),
        ),
        Label: part("MenuLabel", P.Label, "menu-label", menu.label()),
        Separator: part(
            "MenuSeparator",
            P.Separator,
            "menu-separator",
            menu.separator(),
        ),
        Group: part("MenuGroup", P.Group, "menu-group"),
        Shortcut,
        CheckboxItem: checkable("MenuCheckboxItem", P.CheckboxItem, P),
        RadioGroup: part("MenuRadioGroup", P.RadioGroup, "menu-radio-group"),
        RadioItem: checkable("MenuRadioItem", P.RadioItem, P),
        SubTrigger,
        SubContent,
        Content,
    };
}
