import { Badge } from "#/components/atoms/badge";
import { Clickable } from "#/components/atoms/clickable";
import { THEMES } from "#/examples/_themes/themes";
import type { Entry } from "./catalog";
import type { View } from "./view";

type ToolbarProps = {
    view: View;
    entry: Entry | undefined;
    onChange: (view: View) => void;
};

const PRESSED =
    "aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast";

// The entry's name and what it shows, and the settings flipped while watching it: every theme in
// view, one click to switch, and the source panel.
export function Toolbar({ view, entry, onChange }: ToolbarProps) {
    return (
        <header className="flex flex-col gap-2 border-b border-palette-line px-4 py-2">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="me-auto flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-sm font-semibold">
                        {entry?.title ?? "Playground"}
                    </span>
                    {entry && (
                        <span className="text-xs text-palette-accent/85">
                            {entry.kind} · {entry.groupTitle}
                        </span>
                    )}
                </div>
                <fieldset className="flex items-center gap-1">
                    <legend className="sr-only">Theme</legend>
                    <span
                        aria-hidden
                        className="me-1 text-xs text-palette-accent/85"
                    >
                        Theme
                    </span>
                    {THEMES.map((theme) => (
                        <Clickable.Button
                            key={theme.name}
                            variant="ghost"
                            size="sm"
                            aria-pressed={theme.name === view.theme}
                            className={PRESSED}
                            onClick={() =>
                                onChange({ ...view, theme: theme.name })
                            }
                        >
                            {theme.title}
                        </Clickable.Button>
                    ))}
                </fieldset>
                <Clickable.Button
                    variant="outline"
                    size="sm"
                    aria-pressed={view.code}
                    className={PRESSED}
                    onClick={() => onChange({ ...view, code: !view.code })}
                >
                    Source
                </Clickable.Button>
            </div>
            {entry && (entry.description || entry.features.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                    {entry.description && (
                        <p className="me-2 text-xs text-palette-accent/85">
                            {entry.description}
                        </p>
                    )}
                    {entry.features.map((feature) => (
                        <Badge key={feature} variant="outline">
                            {feature}
                        </Badge>
                    ))}
                </div>
            )}
        </header>
    );
}
