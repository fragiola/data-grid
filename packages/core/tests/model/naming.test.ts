import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMANDS } from "../../src";

// The naming rule (AGENTS.md rule 3, Dockable's rule 13): keys are kebab-case; a command has a
// dot, a read has none; a `get` key that takes a payload selecting one thing ends in `-by`, and its
// payload's fields complete the sentence (`row-by { index }`, `column-by { key }`, `row-key-by
// { rowIndex }`); an `is` key is `<entity>-<state>`; an index field is `index` (of what the key
// returns) or `<entity>Index`.

const TYPES = readFileSync(
    join(import.meta.dirname, "../../src/model/types.ts"),
    "utf8",
);

/** The keys of an interface in types.ts, with the source of each key's entry. */
function keysOf(name: string): { key: string; entry: string }[] {
    const start = TYPES.indexOf(`export interface ${name}`);
    const body = TYPES.slice(start, TYPES.indexOf("\n}\n", start));
    return [
        ...body.matchAll(
            /^ {4}(?:"([a-z.-]+)"|([a-z][a-z-]*)):\s*([\s\S]*?)(?=^ {4}(?:"[a-z.-]+"|[a-z][a-z-]*): |\s*$(?![\s\S]))/gm,
        ),
    ].map((match) => ({
        key: match[1] ?? match[2] ?? "",
        entry: match[3] ?? "",
    }));
}

const KEBAB = /^[a-z]+(?:-[a-z]+)*$/;

describe("key names", () => {
    it("commands are `<entity>.<verb>`, kebab-case on both sides", () => {
        const declared = keysOf("CommandMap").map(({ key }) => key);
        expect(declared.sort()).toEqual([...COMMANDS].sort());
        for (const command of COMMANDS) {
            const [entity, verb, ...rest] = command.split(".");
            expect(rest, command).toEqual([]);
            expect(entity, command).toMatch(KEBAB);
            expect(verb, command).toMatch(KEBAB);
        }
    });

    it("get keys name their result; a selecting payload makes them end in -by", () => {
        const queries = keysOf("QueryMap");
        expect(queries.length).toBeGreaterThan(5);
        for (const { key, entry } of queries) {
            expect(key, key).toMatch(KEBAB);
            expect(key, key).not.toContain(".");
            const takesPayload = !/payload:\s*undefined/.test(entry);
            expect(key.endsWith("-by"), key).toBe(takesPayload);
            expect(key, key).not.toMatch(/-by-[a-z]+-(id|index)$/);
        }
    });

    it("is keys are <entity>-<state>, kebab-case", () => {
        for (const { key } of keysOf("QuestionMap")) {
            expect(key, key).toMatch(KEBAB);
            expect(key.split("-").length, key).toBeGreaterThanOrEqual(2);
        }
    });

    it("index fields say whose index they are", () => {
        const fields = [
            ...TYPES.matchAll(/readonly ([a-zA-Z]+Index|index)\b/g),
        ].map((match) => match[1]);
        expect(fields.length).toBeGreaterThan(0);
        for (const field of fields) {
            expect(field, field).toMatch(/^(index|row(Index)|column(Index))$/);
        }
    });
});
