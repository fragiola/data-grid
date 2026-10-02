// Serves the e2e build of the embed app the way the site does: under its base, plus a host page
// that embeds an example in an iframe, as fragiola.com does (same origin).
//
//   node e2e/serve.ts [port]
//
//   /data-grid/embed/react/…         .e2e/dist (built by playwright.config.ts)
//   /host.html?id=<id>&theme=<t>    one iframe on ./?id=<id>&theme=<t>; it records the
//                                   embed's messages in `window.messages` and stays transparent
//                                   until `ready`, like the site

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

export const BASE = "/data-grid/embed/react/";
const DIST = resolve(import.meta.dirname, "../.e2e/dist");
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4320);

const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
};

function host(query: string): string {
    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <title>host</title>
    </head>
    <body style="margin: 0; padding: 16px">
        <iframe
            data-testid="frame"
            title="Example"
            src="${BASE}?${query.replace(/"/g, "&quot;")}"
            style="display: block; width: 900px; height: 600px; border: 0; opacity: 0"
        ></iframe>
        <script>
            window.messages = [];
            const frame = document.querySelector("iframe");
            addEventListener("message", (event) => {
                if (event.origin !== location.origin) return;
                if (event.source !== frame.contentWindow) return;
                window.messages.push(event.data);
                if (event.data && event.data.type === "fragiola:example:ready") {
                    frame.style.opacity = "1";
                }
            });
        </script>
    </body>
</html>`;
}

async function file(pathname: string): Promise<string | undefined> {
    const safe = normalize(decodeURIComponent(pathname)).replace(
        /^(\.\.[/\\])+/,
        "",
    );
    for (const candidate of [
        join(DIST, safe),
        join(DIST, safe, "index.html"),
    ]) {
        if (!candidate.startsWith(DIST)) continue;
        const info = await stat(candidate).catch(() => undefined);
        if (info?.isFile()) return candidate;
    }
    return undefined;
}

createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/host.html") {
        response.writeHead(200, { "content-type": TYPES[".html"] });
        response.end(host(url.searchParams.toString()));
        return;
    }
    const found = url.pathname.startsWith(BASE)
        ? await file(url.pathname.slice(BASE.length))
        : undefined;
    if (!found) {
        response.writeHead(404);
        response.end();
        return;
    }
    response.writeHead(200, {
        "content-type": TYPES[extname(found)] ?? "application/octet-stream",
    });
    createReadStream(found).pipe(response);
}).listen(PORT, () => {
    console.log(`serving ${DIST} at http://localhost:${PORT}${BASE}`);
});
