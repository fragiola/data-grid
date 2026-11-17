import type { InjectionKey } from "vue";

/** The header's box: how many rows of the server's are selected, and what a click does. */
export interface SelectAllState {
    readonly count: number;
    readonly toggle: (checked: boolean) => void;
}

/** Provided by the example, read by the header's checkbox (`select-all.vue`). */
export const SELECT_ALL: InjectionKey<Readonly<{ value: SelectAllState }>> =
    Symbol("select-all");
