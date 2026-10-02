import type { MouseEvent } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Text } from "#/components/atoms/text";
import type { Fixture, Section } from "./catalog";
import { type ItemRef, sameItem } from "./view";

type SidebarProps = {
    sections: Section[];
    fixtures: Fixture[];
    current: ItemRef | null;
    hrefFor: (item: ItemRef) => string;
    onSelect: (item: ItemRef) => void;
};

const ITEM =
    "w-full justify-start aria-[current=page]:bg-palette-soft aria-[current=page]:text-palette-contrast";

/** A plain left click is the shell's; a modified one (new tab, new window) is the browser's. */
function plainClick(event: MouseEvent) {
    return (
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
    );
}

// Every section grouped as the catalog says, then the fixtures. Entries are real links (the URL
// is the state) whose plain clicks the shell handles. Fixtures are pages of their own: their
// links leave the shell.
export function Sidebar({
    sections,
    fixtures,
    current,
    hrefFor,
    onSelect,
}: SidebarProps) {
    return (
        <nav
            aria-label="Playground"
            className="flex min-h-0 flex-col gap-6 overflow-y-auto border-e border-palette-line p-4"
        >
            <Text.Heading as="h1" className="px-3 text-base">
                Data Grid playground
            </Text.Heading>
            {sections.map((section) => (
                <section key={section.kind} className="flex flex-col gap-4">
                    <Text.Heading
                        as="h2"
                        className="px-3 text-xs uppercase tracking-wider"
                    >
                        {section.title}
                    </Text.Heading>
                    {section.groups.map((group) => (
                        <div key={group.key} className="flex flex-col gap-1">
                            <h3 className="px-3 text-xs text-palette-accent/85">
                                {group.title}
                            </h3>
                            <ul className="flex flex-col">
                                {group.entries.map((entry) => {
                                    const item = {
                                        kind: entry.kind,
                                        id: entry.id,
                                    };
                                    return (
                                        <li key={entry.id}>
                                            <Clickable.Link
                                                href={hrefFor(item)}
                                                aria-current={
                                                    sameItem(current, item)
                                                        ? "page"
                                                        : undefined
                                                }
                                                variant="ghost"
                                                size="sm"
                                                className={ITEM}
                                                onClick={(event) => {
                                                    if (!plainClick(event)) {
                                                        return;
                                                    }
                                                    event.preventDefault();
                                                    onSelect(item);
                                                }}
                                            >
                                                <span className="truncate">
                                                    {entry.title}
                                                </span>
                                            </Clickable.Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </section>
            ))}
            {fixtures.length > 0 && (
                <section className="flex flex-col gap-1">
                    <Text.Heading
                        as="h2"
                        className="px-3 text-xs uppercase tracking-wider"
                    >
                        Fixtures
                    </Text.Heading>
                    <p className="px-3 text-xs text-palette-accent/85">
                        Unstyled pages Playwright drives.
                    </p>
                    <ul className="flex flex-col">
                        {fixtures.map((fixture) => (
                            <li key={fixture.name}>
                                <Clickable.Link
                                    href={fixture.href}
                                    variant="ghost"
                                    size="sm"
                                    className={ITEM}
                                >
                                    <span className="truncate">
                                        {fixture.title}
                                    </span>
                                </Clickable.Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </nav>
    );
}
