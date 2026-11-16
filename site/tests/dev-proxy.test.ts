import { createServer, type Server } from "node:http";
import { connect, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createDevProxy, freePort, routeOf } from "../dev-proxy.ts";

// `site:dev` serves every framework's embed on one port: a proxy in front of one dev server per
// framework, routing by `<base>/embed/<framework>/`, hot-reload WebSockets included.

const upstreams = [
    { prefix: "/data-grid/embed/react/", port: 1 },
    { prefix: "/data-grid/embed/vue/", port: 2 },
];

describe("the dev proxy's routes", () => {
    it("send each embed's paths to its own dev server", () => {
        expect(routeOf("/data-grid/embed/react/", upstreams)?.port).toBe(1);
        expect(
            routeOf("/data-grid/embed/vue/src/main.ts", upstreams)?.port,
        ).toBe(2);
        expect(
            routeOf("/data-grid/embed/react/manifest.json", upstreams)?.port,
        ).toBe(1);
        // without its slash, the dev server redirects it
        expect(routeOf("/data-grid/embed/vue", upstreams)?.port).toBe(2);
    });

    it("send nothing else anywhere", () => {
        expect(routeOf("/", upstreams)).toBeUndefined();
        expect(routeOf("/data-grid/embed/angular/", upstreams)).toBeUndefined();
        expect(
            routeOf("/data-grid/embed/reactive/", upstreams),
        ).toBeUndefined();
    });
});

describe("the dev proxy", () => {
    const servers: Server[] = [];
    // upgraded sockets are no longer the server's connections: closed by hand
    const sockets = new Set<Socket>();
    const track = (server: Server) => {
        server.on("connection", (socket) => sockets.add(socket));
        servers.push(server);
    };
    afterEach(async () => {
        for (const socket of sockets) socket.destroy();
        sockets.clear();
        await Promise.all(
            servers.map(
                (server) => new Promise((resolve) => server.close(resolve)),
            ),
        );
        servers.length = 0;
    });

    /** A dev server that names itself, answers the path it got and echoes on an upgrade. */
    async function upstream(name: string): Promise<number> {
        const port = await freePort();
        const server = createServer((request, response) => {
            response.setHeader("x-upstream", name);
            response.end(`${name} ${request.url}`);
        });
        server.on("upgrade", (_request, socket) => {
            socket.write(
                "HTTP/1.1 101 Switching Protocols\r\nUpgrade: echo\r\nConnection: Upgrade\r\n\r\n",
            );
            socket.on("data", (data) => socket.write(`${name}:${data}`));
        });
        await new Promise<void>((resolve) =>
            server.listen(port, "localhost", resolve),
        );
        track(server);
        return port;
    }

    async function proxy(): Promise<number> {
        const react = await upstream("react");
        const vue = await upstream("vue");
        const server = createDevProxy([
            { prefix: "/data-grid/embed/react/", port: react },
            { prefix: "/data-grid/embed/vue/", port: vue },
        ]);
        const port = await freePort();
        await new Promise<void>((resolve) =>
            server.listen(port, "localhost", resolve),
        );
        track(server);
        return port;
    }

    it("forwards each request to its framework's dev server, path and query kept", async () => {
        const port = await proxy();
        const react = await fetch(
            `http://localhost:${port}/data-grid/embed/react/?id=hello-grid`,
        );
        expect(react.headers.get("x-upstream")).toBe("react");
        expect(await react.text()).toBe(
            "react /data-grid/embed/react/?id=hello-grid",
        );
        const vue = await fetch(
            `http://localhost:${port}/data-grid/embed/vue/manifest.json`,
        );
        expect(await vue.text()).toBe("vue /data-grid/embed/vue/manifest.json");
        const other = await fetch(`http://localhost:${port}/elsewhere`);
        expect(other.status).toBe(404);
    });

    it("carries a WebSocket upgrade (hot reload) to the right dev server", async () => {
        const port = await proxy();
        const reply = await new Promise<string>((resolve, reject) => {
            const socket = connect(port, "localhost", () => {
                socket.write(
                    "GET /data-grid/embed/vue/ HTTP/1.1\r\nHost: localhost\r\nUpgrade: echo\r\nConnection: Upgrade\r\n\r\n",
                );
            });
            let received = "";
            socket.on("data", (data) => {
                received += data;
                if (
                    received.includes("\r\n\r\n") &&
                    !received.includes("vue:")
                ) {
                    socket.write("ping");
                }
                if (received.includes("vue:ping")) {
                    socket.end();
                    resolve(received);
                }
            });
            socket.on("error", reject);
        });
        expect(reply).toMatch(/^HTTP\/1\.1 101 Switching Protocols/);
        expect(reply).toContain("vue:ping");
    });
});
