// Which framework an e2e run tests, and which of its examples a spec may open. Free of Playwright,
// so the unit tests check it (tests/e2e-available.test.ts).
//
// One suite for every framework: each app's playwright.config.ts (`examplesE2eConfig`) sets
// `EXAMPLES_FRAMEWORK`, and a spec that opens an example the framework does not have is skipped,
// not failed: a framework may ship a subset of the examples (contract §5) while it is being
// written. A framework of `COMPLETE_FRAMEWORKS` ships every example: a missing one fails.

import { FRAMEWORKS, type Framework, isFramework } from "../src/framework.ts";

/**
 * The frameworks whose app has every example: for them, a spec never skips. A framework joins
 * once its app has them all.
 */
export const COMPLETE_FRAMEWORKS: readonly Framework[] = [
    "react",
    "vue",
    "angular",
];

/** The framework of `EXAMPLES_FRAMEWORK`; anything else throws (a config that forgot to set it). */
export function frameworkOf(value: string | undefined): Framework {
    if (!isFramework(value)) {
        throw new Error(
            `EXAMPLES_FRAMEWORK must be one of ${FRAMEWORKS.join(", ")} (got ${JSON.stringify(value)}): run the suite through an app's playwright.config.ts`,
        );
    }
    return value;
}

/** Where the e2e server mounts a framework's embed, as `site:export --base /data-grid` does. */
export function embedBase(framework: Framework): string {
    return `/data-grid/embed/${framework}/`;
}

/**
 * Why a test that needs `slugs` cannot run in `framework` (its app has none of some of them), or
 * nothing when it can.
 */
export function skipReason(
    framework: Framework,
    available: readonly string[],
    slugs: readonly string[],
): string | undefined {
    const missing = slugs.filter((slug) => !available.includes(slug));
    return missing.length === 0
        ? undefined
        : `${framework} has no ${missing.join(", ")} example`;
}

/**
 * Why a test that needs `slugs` is skipped in `framework`, or nothing when it runs. Throws when
 * the framework is one of `COMPLETE_FRAMEWORKS` and lacks one of them: the test fails instead.
 */
export function skipOrFail(
    framework: Framework,
    available: readonly string[],
    slugs: readonly string[],
): string | undefined {
    const reason = skipReason(framework, available, slugs);
    if (reason !== undefined && COMPLETE_FRAMEWORKS.includes(framework)) {
        throw new Error(
            `${reason}, but every ${framework} example is required (COMPLETE_FRAMEWORKS)`,
        );
    }
    return reason;
}
