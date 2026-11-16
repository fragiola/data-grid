import { Fragment, type Key, type ReactNode } from "react";

/** Each item rendered in a fragment keyed by `key`: what the parts over a list render. */
export function keyed<T>(
    items: readonly T[],
    key: (item: T) => Key,
    render: (item: T) => ReactNode,
): ReactNode[] {
    return items.map((item) => (
        <Fragment key={key(item)}>{render(item)}</Fragment>
    ));
}
