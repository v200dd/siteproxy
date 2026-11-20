/**
 * Built-in homepage route.
 *
 * Serves the token root (with or without a trailing slash) as a 200 HTML page.
 * The page is embedded at build time, so it has no external resource dependency.
 */
import { getConfig } from "../config.mjs";
import { homePageHtml } from "../embedded/index.mjs";

export const serveHomePage = async (context, next) => {
    const config = getConfig();
    let requestUrl = new URL(context.req.url);
    if (context.req.extractedUrl) {
        requestUrl = new URL(context.req.extractedUrl);
    }

    const tokenPrefix = config.token_prefix.endsWith("/") ? config.token_prefix : config.token_prefix + "/";
    const homePath = tokenPrefix;
    const homePathNoSlash = tokenPrefix.slice(0, -1);
    const isHomeRequest = requestUrl.pathname === homePath || requestUrl.pathname === homePathNoSlash;
    const isReadMethod = context.req.method === "GET" || context.req.method === "HEAD";

    if (isHomeRequest && isReadMethod) {
        return context.html(homePageHtml);
    }
    return next();
};
