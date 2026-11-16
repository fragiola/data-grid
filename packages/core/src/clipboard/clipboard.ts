// Tab-separated values (Epic #88, E4.2): what a range of cells is on the clipboard, as the
// spreadsheets write and read it (Excel, Google Sheets, LibreOffice). Pure: the engine copies a
// range through `toTsv` and parses a paste through `parseTsv`; an app may use them too.
//
// A row per line, a tab between values. A value holding a tab, a line break or a double quote is
// quoted (`"…"`), its double quotes doubled; a quoted value keeps its tabs and line breaks.

/** Whether a value must be quoted: it holds a tab, a line break or a double quote. */
const QUOTED = /[\t\n\r"]/;

/** One value as TSV: quoted, its quotes doubled, when it must be. */
function field(value: string): string {
    return QUOTED.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Rows of values as TSV: a tab between values, a line feed between rows (no line break after the
 * last), a value holding a tab, a line break or a double quote quoted.
 */
export function toTsv(rows: readonly (readonly string[])[]): string {
    return rows.map((row) => row.map(field).join("\t")).join("\n");
}

/**
 * TSV as rows of values: lines end with a line feed, a carriage return and a line feed, or a
 * carriage return; one line break at the end is no row (the spreadsheets end a copy with one). A
 * value starting with a double quote is quoted: it ends at the next double quote that is not
 * doubled, and holds tabs and line breaks as they are (what follows it before the next tab or
 * line break is kept, as the spreadsheets do); one never closed is plain text, its quote
 * included. Rows keep their own lengths. Empty text has no rows.
 */
export function parseTsv(text: string): string[][] {
    if (text === "") return [];
    const rows: string[][] = [];
    let row: string[] = [];
    let index = 0;
    const length = text.length;
    for (;;) {
        let value = "";
        if (text[index] === '"') {
            // a quoted value: to the closing quote, doubled ones standing for one; never closed,
            // the quote is text, as the spreadsheets read it (the tabs and line breaks split)
            let quoted = "";
            let at = index + 1;
            for (;;) {
                const quote = text.indexOf('"', at);
                if (quote < 0) break;
                quoted += text.slice(at, quote);
                at = quote + 1;
                if (text[at] !== '"') {
                    value = quoted;
                    index = at;
                    break;
                }
                quoted += '"';
                at += 1;
            }
        }
        // the value (or what follows a quoted one) to the next tab or line break
        let end = index;
        while (end < length) {
            const char = text[end];
            if (char === "\t" || char === "\n" || char === "\r") break;
            end += 1;
        }
        value += text.slice(index, end);
        row.push(value);
        index = end;
        if (index >= length) {
            rows.push(row);
            break;
        }
        const char = text[index];
        index += 1;
        if (char === "\t") continue;
        // a line break: \r\n counts once
        if (char === "\r" && text[index] === "\n") index += 1;
        rows.push(row);
        row = [];
        // one line break at the end is no row
        if (index >= length) break;
    }
    return rows;
}
