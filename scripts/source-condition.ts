// The export condition that points the workspace packages at their sources: the first key of
// their `exports`. Namespaced, so that no consumer's tool ever sets it, and never published (the
// published `exports` are `publishConfig.exports`). The tsconfigs' `customConditions` and the
// packages' `exports` spell it out too; every TypeScript config takes it from here.

export const SOURCE_CONDITION = "@fragiola/source";

/**
 * Vite's default conditions (`defaultClientConditions` or `defaultServerConditions`) with the
 * source one first. Setting `conditions` replaces Vite's defaults, so they are kept here.
 */
export function withSourceCondition(defaults: readonly string[]): string[] {
    return [SOURCE_CONDITION, ...defaults];
}
