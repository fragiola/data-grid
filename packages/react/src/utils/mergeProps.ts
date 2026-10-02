// From Dockable (fragiola/dockable, packages/react/src/utils), same author and licence.
import type * as React from "react";

/** A callback ref that forwards to every ref in `refs` (function refs and ref objects alike). */
export function mergeRefs<T>(
    ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
    return (value) => {
        const cleanups = refs.map((ref) => {
            if (typeof ref === "function") {
                const cleanup = ref(value);
                return typeof cleanup === "function"
                    ? cleanup
                    : () => ref(null);
            }
            if (ref) {
                ref.current = value;
                return () => {
                    ref.current = null;
                };
            }
            return undefined;
        });
        return () => {
            for (const cleanup of cleanups) {
                cleanup?.();
            }
        };
    };
}

type AnyProps = Record<string, unknown>;

function isHandler(
    key: string,
    value: unknown,
): value is (...args: unknown[]) => void {
    return /^on[A-Z]/.test(key) && typeof value === "function";
}

/**
 * Merges `external` props over `internal` ones: plain props from `external` win, event handlers
 * are composed (internal first, then external), `ref`s are merged and `style` objects are merged
 * with `internal` style keys winning (they are the structural ones).
 */
export function mergeProps(internal: AnyProps, external: AnyProps): AnyProps {
    const merged: AnyProps = { ...internal };
    for (const [key, value] of Object.entries(external)) {
        const current = merged[key];
        if (value === undefined) {
            continue;
        }
        if (isHandler(key, value) && isHandler(key, current)) {
            merged[key] = (...args: unknown[]) => {
                current(...args);
                value(...args);
            };
        } else if (key === "ref") {
            merged.ref = current
                ? mergeRefs(
                      current as React.Ref<unknown>,
                      value as React.Ref<unknown>,
                  )
                : value;
        } else if (key === "style") {
            merged.style = {
                ...(value as React.CSSProperties),
                ...(current as React.CSSProperties | undefined),
            };
        } else if (
            key === "className" &&
            typeof current === "string" &&
            typeof value === "string"
        ) {
            merged.className = `${current} ${value}`;
        } else {
            merged[key] = value;
        }
    }
    return merged;
}
