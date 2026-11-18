import type { FeatureTypes } from "../feature/feature";

/** What search keeps in the model's state. */
export interface SearchState {
    /**
     * the text the rows are searched for (`""`: no search). The grid keeps it; the app searches
     * the rows (`/local`: any column's value, as text, containing it, case and accents aside)
     */
    readonly searchText: string;
}

/** What search adds to a root's props: the search text, controlled or not. */
export interface SearchProps {
    /** the search text, controlled; pair it with `onSearchTextChange` */
    searchText?: string | undefined;
    /** the search text to start with, uncontrolled */
    defaultSearchText?: string | undefined;
    /** the search text changed (or, controlled, asks to): a command ran */
    onSearchTextChange?: ((searchText: string) => void) | undefined;
}

/** Search's types (Epic #153). */
export interface SearchTypes extends FeatureTypes {
    readonly state: SearchState;
    readonly options: {
        /** the search text to start with */
        readonly searchText?: string | undefined;
    };
    readonly commands: {
        /** sets the search text (`""`: no search). Returns it */
        "search.set": {
            payload: { readonly text: string };
            result: string;
        };
        /** clears the search text. Returns it (`""`) */
        "search.clear": { payload: undefined; result: string };
    };
    readonly queries: {
        /** the search text (`""`: no search) */
        "search-text": { payload: undefined; result: string };
    };
    readonly questions: {
        /** whether there is a search: a text that is not blank */
        searched: undefined;
    };
    readonly props: SearchProps;
}
