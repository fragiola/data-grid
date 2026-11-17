import type { ComputedRef, InjectionKey } from "vue";

/**
 * The rows "select all" covers: the ones that can be selected, worked out again as the jobs
 * change (an edit can complete one). Given to the header's checkbox through `provide`, so the
 * columns stay the same.
 */
export const SELECTABLE_IDS: InjectionKey<ComputedRef<readonly number[]>> =
    Symbol("selectable-ids");
