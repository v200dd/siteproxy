/**
 * Token-scoped service worker route.
 *
 * The worker script contains the proxy prefix, so this route must only be
 * reachable below /{token}/. Returning it at the root would disclose the token.
 */
import { getConfig } from "../config.mjs";
import { serviceWorkerSource } from "../embedded/index.mjs";

export const serveServiceWorker = async (context, next) => {
    const config = getConfig();
    const proxyPrefix = config.proxy_url + config.token_prefix;
    let requestUrl = new URL(context.req.url);
    if (context.req.extractedUrl) {
        requestUrl = new URL(context.req.extractedUrl);
    }

    const tokenPrefix = config.token_prefix.endsWith("/") ? config.token_prefix : config.token_prefix + "/";
    const serviceWorkerPath = tokenPrefix + "siteproxy_service_worker.js";
    if (requestUrl.pathname !== serviceWorkerPath) {
        return next();
    }

    const searchParams = requestUrl.searchParams;
    const proxyRealProtocol = searchParams.get("proxy_real_protocol");
    const proxyRealHost = searchParams.get("proxy_real_host");
    if (!proxyRealHost) {
        return next();
    }

    // Keep the generated prelude in sync with the service worker's config needs.
    const scriptPrelude =
        "\n      const proxy_url_prefix = '" +
        proxyPrefix +
        "';\n" +
        "      const proxy_real_protocol = '" +
        proxyRealProtocol +
        "';\n" +
        "      const proxy_real_host = '" +
        proxyRealHost +
        "';\n" +
        "      const config_proxy_url = '" +
        config.proxy_url +
        "';\n" +
        "      const config_token_prefix = '" +
        config.token_prefix +
        "';\n    ";
    const scriptBody = scriptPrelude + serviceWorkerSource;

    return context.text(scriptBody, 200, {
        "Content-Type": "application/javascript",
        "Cache-Control": "no-cache, no-store, must-revalidate"
    });
};
