import type { TemplateRef } from "@angular/core";

/**
 * What a template renders with: the context it was given, which is also its `$implicit`
 * (`let-props`, or `let-row="row"` for one field).
 */
export type TemplateContext<C> = C & { readonly $implicit: C };

/**
 * A template and the context it renders with: what a column's renderer returns to render
 * Angular markup (`templateContent(this.nameCell(), props)`).
 */
export interface TemplateContent<C = unknown> {
    readonly template: TemplateRef<TemplateContext<C>>;
    readonly context: C;
}

/**
 * What a column's renderers return in Angular (the core's `TNode`): a template with its context,
 * or text (a string or a number); `null` or `undefined` for nothing.
 */
export type DataGridNode =
    // any template with its own context (an object)
    TemplateContent<object> | string | number | null | undefined;

/**
 * A template and its context, as a column's renderer returns them: `renderCell: (props) =>
 * templateContent(this.nameCell(), props)`. The template's context is typed by the
 * `[dataGridTemplate]` directive on it.
 */
export function templateContent<C extends object>(
    template: TemplateRef<TemplateContext<C>>,
    context: C,
): TemplateContent<C> {
    return { template, context };
}

/** Whether a node is a template with its context. */
export function isTemplateContent(node: unknown): node is TemplateContent {
    return (
        node !== null &&
        typeof node === "object" &&
        "template" in node &&
        "context" in node
    );
}

/**
 * A context type, as `[dataGridTemplate]` takes it to type its template's variables:
 * `readonly nameCell = contextOf<CellTemplateProps<Person>>()`. It holds nothing at run time.
 */
export interface ContextOf<C> {
    /** never set: the context type, for the compiler only */
    readonly context?: C;
}

/** A context type for `[dataGridTemplate]` (nothing at run time). */
export function contextOf<C extends object>(): ContextOf<C> {
    return {};
}
