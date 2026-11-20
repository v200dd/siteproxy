/**
 * Application entry point.
 *
 * Creates the Hono app, registers middleware in a deliberate order, starts the
 * Node HTTP server, and exports the Worker fetch entry. The client script route
 * is intentionally registered before the proxy middleware.
 */
import { Hono } from "hono";
import { loadConfig, isNodeEnvironment, applyWorkerEnv } from "./config.mjs";
import { clientScriptSource } from "./embedded/index.mjs";
import { serveHomePage } from "./routes/home.mjs";
import { serveServiceWorker } from "./routes/service-worker.mjs";
import { normalizeProxyRequest } from "./proxy/normalize.mjs";
import { proxyRequestMiddleware } from "./proxy/request.mjs";

const honoApp = new Hono();

loadConfig((config) => {
    globalThis.proxy_url = config.proxy_url;
    globalThis.token_prefix = config.token_prefix;

    // 1. Browser client script. Kept before the proxy middleware so it is served
    //    directly instead of being treated as an upstream URL.
    honoApp.use("*", async (context, next) => {
        if (context.req.path.endsWith("siteproxy-response-injected.js")) {
            return context.text(clientScriptSource, 200, {
                "Content-Type": "application/javascript",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            });
        }
        await next();
    });

    // 2. Remove upstream CSP headers after proxying. The proxy rewrites bodies
    //    and injects its own client, so the target policy is not meaningful here.
    honoApp.use("*", async (context, next) => {
        await next();
        context.res.headers.delete("Content-Security-Policy");
        context.res.headers.delete("Content-Security-Policy-Report-Only");
    });

    // 3. Proxy pipeline: token-scoped homepage/service worker, target
    //    normalization, then the upstream fetch and response rewrite.
    honoApp.use("*", serveHomePage);
    honoApp.use("*", serveServiceWorker);
    honoApp.use("*", normalizeProxyRequest);
    honoApp.use("*", proxyRequestMiddleware);

    // 4. Final error mapping for the proxy chain.
    honoApp.use("*", async (context, next) => {
        try {
            await next();
        } catch (error) {
            console.error("Error in middleware for " + context.req.url + ": " + error.message);
            return context.text("Internal Server Error: " + error.message, 500);
        }
    });

    // Node-only startup. The adapter is imported dynamically so a Worker build
    // never evaluates Node HTTP modules at module scope.
    if (isNodeEnvironment()) {
        import("@hono/node-server")
            .then(({ serve }) => {
                serve(
                    {
                        fetch: honoApp.fetch,
                        port: config.local_listen_port
                    },
                    (address) => {
                        console.log("Listening on http://localhost:" + address.port);
                    }
                );
            })
            .catch((error) => console.error("Failed to import @hono/node-server:", error));
    }
});

const workerEntry = {
    fetch(request, env, executionCtx) {
        // Wrangler [vars] arrive in env, not process.env.
        applyWorkerEnv(env);
        return honoApp.fetch(request, env, executionCtx);
    }
};

export default workerEntry;
