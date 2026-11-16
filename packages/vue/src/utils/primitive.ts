// From Dockable (fragiola/dockable, packages/vue/src/utils/primitive.ts), same author and licence.
import {
    type DefineSetupFnComponent,
    defineComponent,
    type Prop,
    type PropType,
    type SlotsType,
    type VNode,
    type VNodeChild,
} from "vue";
import type { AsProp } from "./render";

/** A slot function: what a scoped slot of a primitive receives, and the nodes it renders. */
export type SlotFunction<Scope> = (scope: Scope) => VNode[];

/** No events: every listener a primitive takes is a fallthrough attribute or a prop. */
type NoEmits = Record<never, never>;

/**
 * A primitive's public type: a component taking `Props` (plus any fallthrough attribute) with the
 * scoped slots `Slots`. Typed by the row type through `typedDataGrid<TRow>()`.
 */
export type DataGridComponent<
    Props extends object,
    Slots extends object,
> = DefineSetupFnComponent<Props, NoEmits, SlotsType<Slots>>;

/** The props every primitive accepts on top of its own: `as` replaces its element. */
export interface PrimitiveProps {
    /** the tag or component rendered instead of the primitive's element (never `asChild`) */
    as?: AsProp | undefined;
}

/** What a primitive's setup receives with its props. */
export interface PrimitiveContext<Slots> {
    /** the fallthrough attributes: `class`, `style`, listeners, ARIA, `data-*`, … */
    attrs: Record<string, unknown>;
    slots: { readonly [K in keyof Slots]?: Slots[K] };
}

/**
 * The Vue props options of a primitive's props. The names in `booleans` are cast the way Vue casts
 * a boolean prop, so a bare attribute is `true`; absent, they stay `undefined`, so the core's
 * default applies.
 */
function primitiveProps<Name extends string>(
    names: readonly Name[],
    booleans: readonly Name[],
): Record<Name, Prop<unknown> | null> {
    return Object.fromEntries(
        names.map((name) => [
            name,
            booleans.includes(name)
                ? {
                      type: Boolean as PropType<unknown>,
                      default: undefined,
                  }
                : null,
        ]),
    ) as Record<Name, Prop<unknown> | null>;
}

/**
 * Defines a primitive: a component with `inheritAttrs: false` (it merges the fallthrough attributes
 * itself, under its structural style) and the props named in `props` (`booleans`: those that take
 * a bare attribute as `true`).
 */
export function definePrimitive<Props extends object, Slots extends object>(
    name: string,
    props: readonly (keyof Props & string)[],
    setup: (props: Props, context: PrimitiveContext<Slots>) => () => VNodeChild,
    booleans: readonly (keyof Props & string)[] = [],
): DataGridComponent<Props, Slots> {
    return defineComponent({
        name: `DataGrid${name}`,
        inheritAttrs: false,
        props: primitiveProps(props, booleans),
        setup(componentProps, { attrs, slots }) {
            return setup(componentProps as unknown as Props, {
                attrs,
                slots: slots as PrimitiveContext<Slots>["slots"],
            });
        },
    }) as unknown as DataGridComponent<Props, Slots>;
}
