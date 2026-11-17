import type { FeatureTypes } from "../feature/feature";

/** What collapsing keeps in the model's state. */
export interface ColumnGroupCollapseState {
    /**
     * the keys of the collapsed groups, in the order they were collapsed (E1.3). A key that is no
     * collapsible group is kept: it may come back
     */
    readonly collapsedGroupKeys: readonly string[];
}

/** What collapsing adds to a root's props: the collapsed groups, controlled or not. */
export interface ColumnGroupCollapseProps {
    /**
     * the collapsed groups' keys (groups with `collapsible`), controlled; pair it with
     * `onCollapsedGroupKeysChange`. A collapsed group shows only its children for that state
     * (`groupShow`)
     */
    collapsedGroupKeys?: readonly string[] | undefined;
    /** the collapsed groups' keys to start with, uncontrolled */
    defaultCollapsedGroupKeys?: readonly string[] | undefined;
    /** the collapsed groups changed (or, controlled, ask to): a group was toggled, or a command ran */
    onCollapsedGroupKeysChange?:
        | ((collapsedGroupKeys: readonly string[]) => void)
        | undefined;
}

/** Collapsible column groups' types (Epic #85, E1.3; a feature since Epic #148). */
export interface ColumnGroupCollapseTypes extends FeatureTypes {
    readonly state: ColumnGroupCollapseState;
    readonly options: {
        /** the keys of the groups collapsed to start with (an entry that is not a string is dropped) */
        readonly collapsedGroupKeys?: readonly string[] | undefined;
    };
    readonly commands: {
        /**
         * replaces the collapsed groups' keys (each once). A key that is no collapsible group is
         * kept: it may come back. Returns them
         */
        "column-groups.set": {
            payload: { readonly groupKeys: readonly string[] };
            result: readonly string[];
        };
        /**
         * collapses a collapsible group, or expands it when it is collapsed (a group a collapsed
         * one hides included). Returns the collapsed groups' keys
         */
        "column-groups.toggle": {
            payload: { readonly groupKey: string };
            result: readonly string[];
        };
    };
    readonly queries: {
        /** the collapsed groups' keys, in the order they were collapsed */
        "collapsed-group-keys": {
            payload: undefined;
            result: readonly string[];
        };
    };
    readonly questions: {
        /** whether a group is collapsed: a collapsible group, its key collapsed */
        "group-collapsed": { readonly groupKey: string };
    };
    readonly props: ColumnGroupCollapseProps;
}
