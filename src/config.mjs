/**
 * Runtime configuration helpers.
 *
 * Reads config.json under Node, falls back to defaults in a Worker, and keeps
 * the login-host/special-site compatibility lists in one place.
 */

import { createRequire } from "module";
const DEFAULT_TOKEN_PREFIX = "/default/";
function isNodeEnvironment() {
    if (typeof globalThis.addEventListener !== "undefined") {
        return false;
    }
    return true;
}
// Cached config object; in Node it is loaded once from ./config.json.
var appConfig;

/**
 * Reject empty/root tokens and replace them with a deterministic default. This
 * keeps the proxy from becoming an unauthenticated open proxy by accident.
 */
function normalizeConfig(config) {
    if (
        config.token_prefix === undefined ||
        config.token_prefix === null ||
        config.token_prefix === "" ||
        config.token_prefix === "/" ||
        config.token_prefix === "//" ||
        config.token_prefix === DEFAULT_TOKEN_PREFIX
    ) {
        config.token_prefix = DEFAULT_TOKEN_PREFIX;
        config.default_password = true;
    }
    return config;
}
/**
 * Load configuration once and invoke the callback with the normalized object.
 * Node reads ./config.json; a Worker uses built-in defaults because it has no
 * filesystem access.
 */
function loadConfig(onConfig) {
    if (!isNodeEnvironment()) {
        appConfig = normalizeConfig({
            proxy_url: "http://localhost:5006",
            local_listen_port: 5006
        });
        console.log("Configuration loaded:", appConfig.proxy_url, "token configured:", Boolean(appConfig.token_prefix));
        onConfig(appConfig);
    } else {
        let moduleUrl;
        if (import.meta?.url) {
            moduleUrl = import.meta.url;
        } else if (typeof __filename !== "undefined") {
            moduleUrl = "file://" + __filename;
        } else {
            moduleUrl = "file://";
        }
        let nodeRequire = createRequire(moduleUrl)("fs");
        try {
            let configText = nodeRequire.readFileSync("./config.json", "utf8");
            appConfig = normalizeConfig(JSON.parse(configText));
            console.log(
                "Configuration loaded:",
                appConfig.proxy_url,
                "token configured:",
                Boolean(appConfig.token_prefix)
            );
            onConfig(appConfig);
        } catch (error) {
            console.error("Error loading the configuration file:", error);
        }
    }
}
/**
 * Apply Cloudflare Worker [vars] to the process-wide defaults. Wrangler
 * exposes vars through the fetch(env) argument; the rest of the proxy reads
 * config through getConfig(), so this keeps a single source of truth.
 */
function applyWorkerEnv(env) {
    if (!env) {
        return;
    }
    if (env.proxy_url) {
        globalThis.proxy_url = env.proxy_url;
    }
    if (env.token_prefix !== undefined) {
        globalThis.token_prefix = env.token_prefix;
    }
}

/** Return the cached config, or a conservative default when not loaded yet. */
function getConfig() {
    if (isNodeEnvironment()) {
        if (appConfig === undefined) {
            return normalizeConfig({
                proxy_url: globalThis.proxy_url || "http://localhost:5006",
                local_listen_port: globalThis.local_listen_port || 5006,
                token_prefix: globalThis.token_prefix
            });
        } else {
            if (!("token_prefix" in appConfig)) {
                appConfig.token_prefix = globalThis.token_prefix;
            }
            return normalizeConfig(appConfig);
        }
    } else {
        appConfig = {
            proxy_url: globalThis.proxy_url,
            token_prefix: globalThis.token_prefix,
            local_listen_port: 443
        };
        appConfig = normalizeConfig(appConfig);
        return appConfig;
    }
}
// Hosts whose login pages need the special handling in response.mjs.
var loginHosts = ["telegram.org"];

/** Return true when the target host is configured as a login host. */
function isLoginHost(url) {
    let matched = false;
    loginHosts.forEach((host) => {
        if (url.includes(host)) {
            matched = true;
        }
    });
    return matched;
}
// Sites that need to bypass the normal proxy rewrite path.
var specialSitePatterns = ["telegram.org/service_worker.js", "elcomercio.pe", "exchangebank.com"];

/** Return true when the URL matches a special-site compatibility pattern. */
function isSpecialSite(url) {
    if (!url || typeof url != "string") {
        return false;
    }
    let matched = false;
    specialSitePatterns.map((pattern) => {
        if (url.includes(pattern)) {
            matched = true;
        }
    });
    return matched;
}

export {
    DEFAULT_TOKEN_PREFIX,
    isNodeEnvironment,
    normalizeConfig,
    loadConfig,
    getConfig,
    applyWorkerEnv,
    isLoginHost,
    isSpecialSite
};
