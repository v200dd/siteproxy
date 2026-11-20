/**
 * Path normalization before proxying.
 *
 * Converts token, Referer, or proxy-cookie paths into the canonical
 * /{token}/{protocol}/{host}/... form. It does not fetch anything itself.
 */
import { getConfig } from "../config.mjs";
import { parseProtocolHost } from "./cookies.mjs";

var parseCookieStringSimple = (cookieString) => {
    let cookies = {};
    cookieString.split(";").forEach((part) => {
        let [name, value] = part.split("=").map((item) => item.trim());
        cookies[name] = value;
    });
    return cookies;
};
// Normalize token/referer/cookie-derived paths into a proxied target URL.
var normalizeProxyRequest = async (context, next) => {
    let config = getConfig();
    let proxyPrefix = config.proxy_url + config.token_prefix;
    let requestUrl = new URL(context.req.url);
    context.req.extractedUrl = context.req.url;
    let pathname = requestUrl.pathname;
    let hadTokenPrefix = false;
    if (requestUrl.pathname.startsWith(config.token_prefix)) {
        pathname = requestUrl.pathname.substring(config.token_prefix.length);
        hadTokenPrefix = true;
    }
    let tokenIndex = pathname.indexOf(config.token_prefix);
    if (tokenIndex !== -1) {
        pathname = pathname.substring(tokenIndex + config.token_prefix.length);
        let { protocol: protocol, host: host } = parseProtocolHost(pathname);
        if (protocol === "http" || protocol === "https") {
            pathname = pathname.substring(pathname.indexOf(host) + host.length);
            let rewrittenUrl = "" + proxyPrefix + protocol + "/" + host + pathname + requestUrl.search;
            if (pathname) {
                context.req.extractedUrl = rewrittenUrl;
            }
            return await next();
        }
    }
    let { protocol: cookieProtocol, host: cookieHost } = parseProtocolHost(pathname);
    if (pathname === "") {
        let homeUrl = proxyPrefix;
        if (pathname) {
            context.req.extractedUrl = homeUrl;
        }
        if (hadTokenPrefix) {
            return context.redirect(homeUrl);
        } else {
            return await next();
        }
    } else if (cookieProtocol !== "http" && cookieProtocol !== "https") {
        if (config.default_password) {
            let defaultHomeUrl = proxyPrefix;
            if (pathname) {
                context.req.extractedUrl = defaultHomeUrl;
            }
            return context.redirect(defaultHomeUrl);
        }
        let cookieValues = parseCookieStringSimple(context.req.raw.headers.get("cookie") || "");
        cookieProtocol = cookieValues.proxy_real_protocol;
        cookieHost = cookieValues.proxy_real_host;
        if (cookieProtocol && cookieHost) {
            let cookieRewrittenUrl =
                "" + proxyPrefix + cookieProtocol + "/" + cookieHost + pathname + requestUrl.search;
            if (pathname) {
                context.req.extractedUrl = cookieRewrittenUrl;
            }
            return await next();
        }
    }
    let unproxiedSearch = unproxyUrl(requestUrl.search);
    if (unproxiedSearch !== requestUrl.search) {
        let searchRewrittenUrl = requestUrl.protocol + "//" + requestUrl.host + requestUrl.pathname + unproxiedSearch;
        if (pathname) {
            context.req.extractedUrl = searchRewrittenUrl;
        }
        return await next();
    }
    await next();
};
var unproxyUrl = (url) => {
    let config = getConfig();
    let proxyPrefix = config.proxy_url + config.token_prefix;
    let result = url.replace(new RegExp(proxyPrefix + "(http[s]?)/([^/]+)"), "$1://$2");
    result = result || "";
    return result;
};

export { normalizeProxyRequest };
