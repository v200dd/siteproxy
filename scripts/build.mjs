/**
 * Build the deployable bundles from src/.
 *
 * - bundle.mjs is the local Node entry.
 * - worker.js is the Cloudflare Workers entry.
 *
 * Text assets (client, service worker, homepage) are loaded through the
 * text-asset plugin, so the source tree keeps them as ordinary files.
 */
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

// Load files under src/assets as text instead of parsing them as modules. This
// keeps the client, service worker, and homepage ordinary source files while
// still embedding their contents in the Worker bundle.
const textAssetPlugin = {
    name: "text-assets",
    setup(build) {
        build.onResolve({ filter: /^\.\.\/assets\/.*\.(js|html)$/ }, (args) => ({
            path: path.relative(process.cwd(), path.resolve(args.resolveDir, args.path)).split(path.sep).join("/"),
            namespace: "text-asset"
        }));
        build.onLoad({ filter: /.*/, namespace: "text-asset" }, (args) => ({
            contents: fs.readFileSync(path.resolve(process.cwd(), args.path), "utf8"),
            loader: "text"
        }));
    }
};

const common = {
    bundle: true,
    format: "esm",
    target: "es2022",
    plugins: [textAssetPlugin],
    legalComments: "none",
    logLevel: "info"
};

await build({
    ...common,
    entryPoints: ["src/index.mjs"],
    outfile: "bundle.mjs",
    platform: "node"
});

const workerExternals = [
    "@hono/node-server",
    "module",
    "node:module",
    "fs",
    "node:fs",
    "http",
    "node:http",
    "http2",
    "node:http2",
    "stream",
    "node:stream",
    "crypto",
    "node:crypto",
    "zlib",
    "node:zlib"
];

await build({
    ...common,
    entryPoints: ["src/index.mjs"],
    outfile: "worker.js",
    platform: "neutral",
    external: workerExternals
});

console.log("build complete");
