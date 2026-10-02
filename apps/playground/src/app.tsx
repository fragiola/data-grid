import { useEffect, useLayoutEffect, useState } from "react";
import { entries, findEntry, fixtures, sections } from "./catalog";
import { Sidebar } from "./sidebar";
import { SourcePanel } from "./source-panel";
import { Stage } from "./stage";
import { Toolbar } from "./toolbar";
import { applyTheme, parseView, sameItem, toSearch, type View } from "./view";

// The shell: sidebar, toolbar, stage and source panel, built from the Fragiola UI vendored in
// examples/react and painted through palette roles only. The stage shows the entry alone, as the
// site does.
export function App() {
    const [view, setView] = useState(() => parseView(window.location.search));
    const entry = findEntry(view.item);

    useLayoutEffect(() => applyTheme(view.theme), [view.theme]);

    useEffect(() => {
        document.title = entry
            ? `${entry.title} · Data Grid playground`
            : "Data Grid playground";
    }, [entry]);

    // Choosing an entry is a navigation: back returns to the previous one. The theme and the
    // panel are settings: they stay as they are through back and forward, and only rewrite the
    // current URL.
    useEffect(() => {
        const search = toSearch(view);
        if ((window.location.search || "?") !== search) {
            window.history.replaceState(null, "", search);
        }
    }, [view]);

    useEffect(() => {
        const restore = () => {
            const { item } = parseView(window.location.search);
            setView((current) => ({ ...current, item }));
        };
        window.addEventListener("popstate", restore);
        return () => window.removeEventListener("popstate", restore);
    }, []);

    // Choosing the entry already shown adds no history entry.
    function navigate(next: View) {
        if (!sameItem(next.item, view.item)) {
            window.history.pushState(null, "", toSearch(next));
        }
        setView(next);
    }

    const itemKey = entry ? `${entry.kind}:${entry.id}` : "none";

    return (
        <div className="grid h-dvh grid-cols-[16rem_minmax(0,1fr)]">
            <Sidebar
                sections={sections}
                fixtures={fixtures}
                current={view.item}
                hrefFor={(item) => toSearch({ ...view, item })}
                onSelect={(item) => navigate({ ...view, item })}
            />
            <div className="flex min-h-0 min-w-0 flex-col">
                <Toolbar view={view} entry={entry} onChange={setView} />
                <div className="flex min-h-0 flex-1">
                    <main className="min-w-0 flex-1 overflow-auto">
                        {entry ? (
                            <Stage key={itemKey} entry={entry} />
                        ) : (
                            <p className="p-8 text-sm text-palette-accent/85">
                                {view.item
                                    ? `No ${view.item.kind} with id “${view.item.id}”.`
                                    : `Pick one of the ${entries.length} entries.`}
                            </p>
                        )}
                    </main>
                    {view.code && entry && (
                        <SourcePanel key={itemKey} entry={entry} />
                    )}
                </div>
            </div>
        </div>
    );
}
