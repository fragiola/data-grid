import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeatureState,
} from "../feature/feature";
import { done, fail } from "../model/result";
import type { SearchProps, SearchTypes } from "./types";

// Search (Epic #153): the model keeps the search text (`search.set`, `search.clear`), and a root
// takes `searchText` / `defaultSearchText` / `onSearchTextChange`. The grid never searches the
// rows: the app does (`/local` in memory, a server otherwise), and the search input is the app's.

/** The state as search reads it. */
type State = FeatureState<SearchTypes>;

/** The state with this search text: the same object when it is the one it holds. */
function withText(state: State, text: unknown) {
    if (typeof text !== "string") {
        return fail("invalid_payload", "text must be a string");
    }
    const next =
        text === state.searchText ? state : { ...state, searchText: text };
    return done(next, next.searchText);
}

/** The search feature's definition: every grid installing it shares it. */
const SEARCH = defineFeature<SearchTypes>({
    name: "search",
    initial: (_, options) => ({
        searchText:
            typeof options.searchText === "string" ? options.searchText : "",
    }),
    commands: {
        "search.set": (state, payload) => withText(state, payload?.text),
        "search.clear": (state) => withText(state, ""),
    },
    queries: {
        "search-text": (state) => state.searchText,
    },
    questions: {
        searched: (state) => state.searchText.trim() !== "",
    },
    root: {
        props: ["searchText", "defaultSearchText", "onSearchTextChange"],
        options: (props) => ({
            searchText: props.searchText ?? props.defaultSearchText,
        }),
        controlled: (model) => [
            defineControlled<SearchProps, State, string>({
                prefix: "search.",
                prop: (props) => props.searchText,
                onChange: (props) => props.onSearchTextChange,
                read: (state) => state.searchText,
                same: Object.is,
                apply: (value) => {
                    model.run("search.set", { text: value });
                },
            }),
        ],
    },
});

/**
 * Search (`@fragiola/data-grid/search`): install it on a grid (`features: [search()]`) for the
 * model to keep the search text. The grid keeps it; the app searches the rows (`/local` in
 * memory).
 */
export function search(): DataGridFeature<SearchTypes> {
    return SEARCH;
}
