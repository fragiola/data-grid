// The one port `pnpm site:dev` listens on, in front of one dev server per framework: `www` in dev
// proxies a single `devUrl` (`/<slug>/embed/**`), and each framework's embed app runs its own
// dev server. Requests and WebSocket upgrades (hot reload) go to the server whose prefix
// (`<base>/embed/<framework>/`) the path starts with. Node's `http` and `net` only: no dependency.

import {
    createServer,
    type IncomingMessage,
    request,
    type Server,
} from "node:http";
import { connect, createServer as createNetServer } from "node:net";

/** A dev server behind the proxy: every path under `prefix` goes to `port` on localhost. */
export interface Upstream {
    prefix: string;
    port: number;
}

/** The upstream a path belongs to (the longest matching prefix), or nothing. */
export function routeOf(
    pathname: string,
    upstreams: readonly Upstream[],
): Upstream | undefined {
    return [...upstreams]
        .sort((a, b) => b.prefix.length - a.prefix.length)
        .find(
            (upstream) =>
                pathname.startsWith(upstream.prefix) ||
                // `<base>/embed/react` without its slash: the dev server redirects it
                `${pathname}/` === upstream.prefix,
        );
}

function pathnameOf(message: IncomingMessage): string {
    return new URL(message.url ?? "/", "http://localhost").pathname;
}

/** The request line and headers of `message`, as they arrived, to replay on a raw socket. */
function head(message: IncomingMessage): string {
    const lines = [
        `${message.method} ${message.url} HTTP/${message.httpVersion}`,
    ];
    for (let i = 0; i < message.rawHeaders.length; i += 2) {
        lines.push(`${message.rawHeaders[i]}: ${message.rawHeaders[i + 1]}`);
    }
    return `${lines.join("\r\n")}\r\n\r\n`;
}

/** A proxy (not listening yet) that forwards to `upstreams` and answers 404 elsewhere. */
export function createDevProxy(upstreams: readonly Upstream[]): Server {
    const server = createServer((incoming, outgoing) => {
        const upstream = routeOf(pathnameOf(incoming), upstreams);
        if (!upstream) {
            outgoing.writeHead(404, { "content-type": "text/plain" });
            outgoing.end(
                `Not an embed. Served here:\n${upstreams.map((u) => `  ${u.prefix}`).join("\n")}\n`,
            );
            return;
        }
        const forward = request(
            {
                host: "localhost",
                port: upstream.port,
                method: incoming.method,
                path: incoming.url,
                headers: incoming.headers,
            },
            (response) => {
                outgoing.writeHead(
                    response.statusCode ?? 502,
                    response.headers,
                );
                response.pipe(outgoing);
            },
        );
        forward.on("error", (error) => {
            if (!outgoing.headersSent) {
                outgoing.writeHead(502, { "content-type": "text/plain" });
            }
            outgoing.end(`${upstream.prefix}: ${error.message}\n`);
        });
        incoming.pipe(forward);
    });
    // hot reload: the WebSocket handshake is replayed on a raw socket, then both ends are piped
    server.on("upgrade", (incoming, socket, rest) => {
        const upstream = routeOf(pathnameOf(incoming), upstreams);
        if (!upstream) {
            socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
            return;
        }
        const target = connect(upstream.port, "localhost", () => {
            target.write(head(incoming));
            if (rest.length > 0) target.write(rest);
            target.pipe(socket);
            socket.pipe(target);
        });
        target.on("error", () => socket.destroy());
        socket.on("error", () => target.destroy());
    });
    return server;
}

/** A port nothing listens on right now, for a dev server behind the proxy. */
export function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const probe = createNetServer();
        probe.once("error", reject);
        probe.listen(0, "localhost", () => {
            const address = probe.address();
            const port =
                typeof address === "object" && address ? address.port : 0;
            probe.close(() => resolve(port));
        });
    });
}
