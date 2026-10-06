import { describe, expect, it } from "vitest";
import { parseTsv, toTsv } from "../src";

// Tab-separated values (Epic #88, E4.2): what a range is on the clipboard, written and read as
// the spreadsheets do.

describe("toTsv", () => {
    it("joins values with tabs and rows with line feeds, no line break after the last", () => {
        expect(
            toTsv([
                ["a", "b"],
                ["c", "d"],
            ]),
        ).toBe("a\tb\nc\td");
        expect(toTsv([["only"]])).toBe("only");
        expect(toTsv([[""]])).toBe("");
        expect(toTsv([])).toBe("");
    });

    it("quotes a value holding a tab, a line break or a double quote, its quotes doubled", () => {
        expect(toTsv([["a\tb", 'say "hi"', "two\nlines", "cr\r"]])).toBe(
            '"a\tb"\t"say ""hi"""\t"two\nlines"\t"cr\r"',
        );
        // a quote alone in a value is quoted too: it would start a quoted value
        expect(toTsv([['"', "plain 'single'"]])).toBe('""""\tplain \'single\'');
    });
});

describe("parseTsv", () => {
    it("splits rows on line feeds, CRLF or carriage returns, and values on tabs", () => {
        expect(parseTsv("a\tb\nc\td")).toEqual([
            ["a", "b"],
            ["c", "d"],
        ]);
        expect(parseTsv("a\tb\r\nc\td")).toEqual([
            ["a", "b"],
            ["c", "d"],
        ]);
        expect(parseTsv("a\rb")).toEqual([["a"], ["b"]]);
    });

    it("drops one line break at the end (the spreadsheets end a copy with one)", () => {
        expect(parseTsv("a\tb\r\n")).toEqual([["a", "b"]]);
        expect(parseTsv("a\n")).toEqual([["a"]]);
        // a copied empty cell is a line break: one empty value
        expect(parseTsv("\r\n")).toEqual([[""]]);
        // a second one is an empty row
        expect(parseTsv("a\n\n")).toEqual([["a"], [""]]);
    });

    it("keeps empty values and rows of their own lengths", () => {
        expect(parseTsv("\tb\t")).toEqual([["", "b", ""]]);
        expect(parseTsv("a\nb\tc\td")).toEqual([["a"], ["b", "c", "d"]]);
    });

    it("has no rows for empty text", () => {
        expect(parseTsv("")).toEqual([]);
    });

    it("reads quoted values: tabs, line breaks and doubled quotes inside", () => {
        expect(parseTsv('"a\tb"\t"say ""hi"""\n"two\r\nlines"\tx')).toEqual([
            ["a\tb", 'say "hi"'],
            ["two\r\nlines", "x"],
        ]);
        // a quote inside an unquoted value is a character
        expect(parseTsv('5" screen\tb')).toEqual([['5" screen', "b"]]);
        // after a quoted value, what comes before the tab is kept
        expect(parseTsv('"a"b\tc')).toEqual([["ab", "c"]]);
        // never closed: plain text, the quote kept, the tabs and line breaks splitting
        expect(parseTsv('"open\tand on')).toEqual([['"open', "and on"]]);
    });

    it("reads back what toTsv writes", () => {
        const rows = [
            ["plain", "with\ttab", 'with "quotes"'],
            ["multi\nline", "", "cr\r\nlf"],
            ["", "", ""],
        ];
        expect(parseTsv(toTsv(rows))).toEqual(rows);
    });

    it("reads what Excel and Google Sheets copy", () => {
        // Excel: CRLF rows, a trailing CRLF, a cell with a line break quoted
        expect(parseTsv('Name\tNote\r\nAda\t"first\nlast"\r\n')).toEqual([
            ["Name", "Note"],
            ["Ada", "first\nlast"],
        ]);
        // text starting with an inch mark, never closed: text, the rows and values split
        expect(parseTsv('"12 inch\tscreen\n15 inch\tlaptop\r\n')).toEqual([
            ['"12 inch', "screen"],
            ["15 inch", "laptop"],
        ]);
        // Google Sheets: LF rows, no trailing line break
        expect(parseTsv("1\t2\n3\t4")).toEqual([
            ["1", "2"],
            ["3", "4"],
        ]);
    });
});
