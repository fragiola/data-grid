import { useEffect, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import type { Entry } from "./catalog";

// The files behind what the stage shows, verbatim: the code a reader copies for an example. Plain
// text: highlighting would be a dependency. The App keys the panel by entry, so switching starts
// from the entry file.
export function SourcePanel({ entry }: { entry: Entry }) {
    const [index, setIndex] = useState(0);
    const [source, setSource] = useState<string | null>(null);
    const file = entry.files[index];

    useEffect(() => {
        if (!file) return;
        let live = true;
        setSource(null);
        file.load().then(
            (text) => live && setSource(text),
            (error: unknown) => live && setSource(String(error)),
        );
        return () => {
            live = false;
        };
    }, [file]);

    return (
        <aside
            aria-label="Source"
            className="flex w-[min(40rem,45%)] min-w-0 flex-col border-s border-palette-line"
        >
            {entry.files.length > 1 && (
                <div className="flex flex-wrap gap-1 border-b border-palette-line px-2 py-1">
                    {entry.files.map((f, i) => (
                        <Clickable.Button
                            key={f.path}
                            variant="ghost"
                            size="sm"
                            aria-pressed={i === index}
                            className="font-mono text-xs aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast"
                            onClick={() => setIndex(i)}
                        >
                            {f.path.slice(f.path.lastIndexOf("/") + 1)}
                        </Clickable.Button>
                    ))}
                </div>
            )}
            <p
                data-testid="source-path"
                className="truncate border-b border-palette-line px-4 py-2 font-mono text-xs text-palette-accent/85"
            >
                {file?.path ?? "No source file"}
            </p>
            <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
                <code>{source}</code>
            </pre>
        </aside>
    );
}
