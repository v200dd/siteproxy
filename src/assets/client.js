/*
 * Deobfuscated from siteproxy 2.7.11 (bundle.mjs).
 * Generated with Node 22.14.0 + webcrack 2.15.1 plus a local string-array prepass.
 * This is a reverse-engineered equivalent, not the original source.
 * See README.md in this directory for scope and limitations.
 */
(function () {
    if (!window.siteproxy_injected_flag) {
        window.siteproxy_injected_flag = true;
        try {
            console.log("[SiteProxy] Injected script start");
            if (window.siteproxyLog) {
                window.siteproxyLog("[SiteProxy] injected script starting");
            }
            window.addEventListener("popstate", function (event) {
                if (window.siteproxyLog) {
                    window.siteproxyLog("[SiteProxy] popstate", window.location.href);
                }
            });
            window.addEventListener("hashchange", function (event) {
                if (window.siteproxyLog) {
                    window.siteproxyLog("[SiteProxy] hashchange", event.newURL);
                }
            });
            window.___URL = window.URL;
            (function () {
                if (typeof Proxy === "undefined") {
                    window.Proxy = function (target, handler) {
                        console.warn("Proxy unsupported; falling back to direct overrides");
                        return target;
                    };
                }
                function rewriteUrlFallback(url) {
                    if (!url || url.startsWith(proxy_url_prefix)) {
                        return url;
                    }
                    const proxyHost = config_proxy_url.substring(config_proxy_url.indexOf("//") + 2);
                    let strippedProxy = false;
                    if (url.startsWith(config_proxy_url)) {
                        url = url.substring(config_proxy_url.length);
                        strippedProxy = true;
                    } else if (url.startsWith(config_proxy_url.replace("http://", "https://"))) {
                        url = url.substring(config_proxy_url.replace("http://", "https://").length);
                        strippedProxy = true;
                    } else if (url.startsWith("//" + proxyHost)) {
                        url = url.substring(("//" + proxyHost).length);
                        strippedProxy = true;
                    }
                    if (url.match(new RegExp("^[a-z]+://", "i"))) {
                        const protocol = url.split("://")[0].toLowerCase();
                        if (protocol !== "http" && protocol !== "https" && protocol !== "ftp") {
                            return url;
                        }
                    }
                    if (url.startsWith("data:")) {
                        return url;
                    }
                    if (url.match(new RegExp("ftp://", "i"))) {
                        return url;
                    }
                    if (url.match(new RegExp("^https?://", "i"))) {
                        return url;
                    }
                    const absoluteUrlPattern = new RegExp("()(https?://|//)([^\\s]+)", "g");
                    let result = "";
                    let lastIndex = 0;
                    let match;
                    let replaced = false;
                    while ((match = absoluteUrlPattern.exec(url)) !== null) {
                        replaced = true;
                        const matchIndex = match.index;
                        const scheme = match[2];
                        const rest = match[3];
                        result += url.substring(lastIndex, matchIndex);
                        const normalizedProtocol = scheme === "//" ? "https" : scheme.replace("://", "").toLowerCase();
                        const rewritten = proxy_url_prefix + normalizedProtocol + "/" + rest;
                        result += rewritten;
                        lastIndex = absoluteUrlPattern.lastIndex;
                    }
                    result += url.substring(lastIndex);
                    url = result;
                    let proxyBase = proxy_url_prefix + proxy_real_protocol + "/" + proxy_real_host;
                    let proxyPrefix = proxy_url_prefix;
                    if (url.startsWith("//")) {
                        url = proxyPrefix + "/https/" + url.slice(2);
                        url = url.replace("//https", "/https");
                    } else if (url.startsWith("/") && !strippedProxy) {
                        url = proxyBase + url;
                    }
                    if (url.match(new RegExp("^[a-z]+://", "i")) && !replaced) {
                        return url;
                    }
                    return url;
                }
                window.siteproxyRegReplacementFallback = rewriteUrlFallback;
                function removeProxyPrefixFallback(url) {
                    if (!url) {
                        return url;
                    }
                    if (url.startsWith(proxy_url_prefix)) {
                        url = url.replace(proxy_url_prefix, "");
                    }
                    if (url.match(new RegExp("^[a-z]+://", "i"))) {
                        return url;
                    }
                    let tokenPrefix = config_token_prefix;
                    if (tokenPrefix.startsWith("/")) {
                        tokenPrefix = tokenPrefix.substring(1);
                    }
                    if (url.startsWith(tokenPrefix)) {
                        url = url.substring(tokenPrefix.length);
                    }
                    let protocol = url.split("/")[0].toLowerCase();
                    if (protocol === "http" || protocol === "https") {
                        url = url.replace(protocol + "/", protocol + "://");
                    } else {
                        url = proxy_real_protocol + "://" + proxy_real_host + "/" + url;
                    }
                    return url;
                }
                window.removeProxyPrefixFallback = removeProxyPrefixFallback;
                window.removeProxyPrefix = (url) => window.urlMeta.unrewrite(url);
                function stripRepeatedPrefix(value, prefix) {
                    if (!prefix) {
                        return value;
                    }
                    while (value.startsWith(prefix) || value.startsWith("/" + prefix)) {
                        if (value.startsWith(prefix)) {
                            value = value.substring(prefix.length);
                        } else {
                            value = value.substring(prefix.length + 1);
                        }
                    }
                    return value;
                }
                function rewriteUrl(url, protocol, host) {
                    if (!url.startsWith(config_proxy_url)) {
                        return removeProxyPrefixFallback(url);
                    }
                    let path = url.replace(config_proxy_url, "").replace(new RegExp("^/+", ""), "");
                    path = stripRepeatedPrefix(path, "p");
                    let tokenPrefix = config_token_prefix ? config_token_prefix.substring(1) : "";
                    path = stripRepeatedPrefix(path, tokenPrefix);
                    path = path.replace(new RegExp("^/+", ""), "");
                    if (!path) {
                        return protocol + "://" + host + "/";
                    }
                    const protocolMatch = path.match(
                        new RegExp(
                            "^(http|https|ftp|file|data|javascript|mailto|tel|sms|ssh|vbscript|about|chrome|view-source|webcal|content)/",
                            "i"
                        )
                    );
                    if (protocolMatch) {
                        const scheme = protocolMatch[1].toLowerCase();
                        let rest = path.substring(protocolMatch[0].length).replace(new RegExp("^/+", ""), "");
                        const absoluteUrl = scheme + "://" + rest;
                        try {
                            const parsedUrl = new URL(absoluteUrl);
                            if (parsedUrl.hostname === "localhost") {
                                return url;
                            }
                            return parsedUrl.href;
                        } catch (error) {
                            console.error("URL unrewrite inner error:", error);
                            const pathStart = rest.indexOf("/") !== -1 ? rest.indexOf("/") : rest.length;
                            const hostPart = rest.substring(0, pathStart);
                            const pathPart =
                                pathStart < rest.length
                                    ? "/" + rest.substring(pathStart).replace(new RegExp("^/+", ""), "")
                                    : "";
                            return scheme + "://" + hostPart + pathPart;
                        }
                    } else {
                        const rootPath = "/" + path.replace(new RegExp("^/+", ""), "");
                        return protocol + "://" + host + rootPath;
                    }
                }
                window.getRefererFromLocation = rewriteUrl;
                class URLMeta {
                    constructor(href = window.location.href, frameName = "") {
                        this.baseUrl = new URL(removeProxyPrefixFallback(href));
                        this.frameName = frameName;
                    }
                    rewrite(input) {
                        const originalValue = input;
                        if (input && typeof input === "object" && input.href && typeof input.href === "string") {
                            input = input.href;
                        } else if (input instanceof URL) {
                            input = input.href;
                        }
                        if (typeof input !== "string") {
                            return originalValue;
                        }
                        const value = input;
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[URLMeta.rewrite] input:", input);
                        }
                        if (input.startsWith("data:")) {
                            return input;
                        }
                        if (input.match(new RegExp("^data:", "i"))) {
                            return input;
                        }
                        try {
                            if (!input || input.startsWith(proxy_url_prefix)) {
                                return input;
                            }
                            if (config_token_prefix && input.startsWith(config_token_prefix)) {
                                return input;
                            }
                            if (input.includes(" ")) {
                                return rewriteUrlFallback(input);
                            }
                            if (input.match(new RegExp("^[a-z]+://", "i"))) {
                                const protocol = input.split("://")[0].toLowerCase();
                                if (!["http", "https"].includes(protocol)) {
                                    return input;
                                }
                            }
                            if (input.startsWith("//")) {
                                const proxyHost = config_proxy_url.substring(config_proxy_url.indexOf("//") + 2);
                                if (input.startsWith("//" + proxyHost)) {
                                    return value;
                                }
                                input = "https:" + input;
                            }
                            let host = "";
                            const schemeIndex = input.indexOf("://");
                            if (schemeIndex !== -1) {
                                host = input.slice(schemeIndex + 3);
                            } else if (input.startsWith("//")) {
                                host = input.slice(2);
                            }
                            if (host) {
                                const pathStart = host.search(new RegExp("[/?#]", ""));
                                if (pathStart !== -1) {
                                    host = host.slice(0, pathStart);
                                }
                            }
                            let portMatch = host ? host.match(new RegExp(":(\\d{1,5})$", "")) : null;
                            let port = portMatch ? portMatch[1] : "";
                            let parsedUrl = new URL(input, this.baseUrl.href);
                            let proxyUrlHost = config_proxy_url.substring(config_proxy_url.indexOf("//") + 2);
                            if (proxyUrlHost.endsWith("/")) {
                                proxyUrlHost = proxyUrlHost.slice(0, -1);
                            }
                            if (parsedUrl.origin === window.location.origin || parsedUrl.host === proxyUrlHost) {
                                const tokenPrefix = config_token_prefix || "";
                                if (tokenPrefix && parsedUrl.pathname.startsWith(tokenPrefix)) {
                                    return value;
                                }
                                if (window.siteproxyLog) {
                                    window.siteproxyLog(
                                        "[URLMeta.rewrite] proxy origin missing token prefix",
                                        parsedUrl.href,
                                        tokenPrefix
                                    );
                                }
                                if (parsedUrl.protocol === "blob:") {
                                    return value;
                                }
                                const proxyProtocol = proxy_real_protocol;
                                const proxyRealHost = proxy_real_host;
                                const path = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
                                const hostPath = proxyRealHost + path;
                                const rewritten = proxy_url_prefix + proxyProtocol + "/" + hostPath;
                                if (window.siteproxyLog) {
                                    window.siteproxyLog("[URLMeta.rewrite] output:", rewritten);
                                }
                                return rewritten;
                            }
                            if (this.isSpecialScheme(parsedUrl.protocol)) {
                                return value;
                            }
                            let targetProtocol = parsedUrl.protocol.replace(":", "");
                            let targetHost = parsedUrl.hostname;
                            const defaultPort = targetProtocol === "http" ? "80" : "443";
                            if (port) {
                                targetHost += ":" + port;
                            } else if (parsedUrl.port && parsedUrl.port !== defaultPort) {
                                targetHost += ":" + parsedUrl.port;
                            }
                            const targetPath = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
                            const targetHostAndPath = targetHost + targetPath;
                            const proxiedUrl = proxy_url_prefix + targetProtocol + "/" + targetHostAndPath;
                            if (window.siteproxyLog) {
                                window.siteproxyLog("[URLMeta.rewrite] output:", proxiedUrl);
                            }
                            return proxiedUrl;
                        } catch (error) {
                            console.error("URL rewrite error:", error);
                            return rewriteUrlFallback(value);
                        }
                    }
                    isSpecialScheme(url) {
                        return [
                            "blob:",
                            "javascript:",
                            "mailto:",
                            "#",
                            "about:",
                            "chrome:",
                            "data:",
                            "ftp:",
                            "file:",
                            "tel:",
                            "sms:",
                            "view-source:",
                            "webcal:",
                            "content:",
                            "ssh:",
                            "vbscript:"
                        ].some((prefix) => url.startsWith(prefix));
                    }
                    unrewrite(input) {
                        try {
                            const originalValue = input;
                            if (input && typeof input === "object" && input.href && typeof input.href === "string") {
                                input = input.href;
                            } else if (input instanceof URL) {
                                input = input.href;
                            }
                            if (typeof input !== "string") {
                                return originalValue;
                            }
                            if (window.siteproxyLog) {
                                window.siteproxyLog("[URLMeta.unrewrite] input:", input);
                            }
                            if (!input.startsWith(proxy_url_prefix)) {
                                try {
                                    const parsedUrl = new URL(input);
                                    if (parsedUrl.origin === window.location.origin) {
                                        const path = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
                                        const absoluteUrl = proxy_real_protocol + "://" + proxy_real_host + path;
                                        if (window.siteproxyLog) {
                                            window.siteproxyLog("[URLMeta.unrewrite] output (base path):", absoluteUrl);
                                        }
                                        return absoluteUrl;
                                    }
                                } catch (error) {
                                    console.error("URL origin check error:", error);
                                }
                                return input;
                            }
                            let url = input.replace(proxy_url_prefix, "");
                            let tokenPrefix = config_token_prefix ? config_token_prefix.substring(1) : "";
                            if (window.siteproxyLog) {
                                window.siteproxyLog(
                                    "[URLMeta.unrewrite] proxy_url_prefix:",
                                    proxy_url_prefix,
                                    "tokenShort:",
                                    tokenPrefix
                                );
                            }
                            url = stripRepeatedPrefix(url, tokenPrefix);
                            url = url.replace(new RegExp("^/+", ""), "");
                            if (window.siteproxyLog) {
                                window.siteproxyLog("[URLMeta.unrewrite] clean after stripping:", url);
                            }
                            if (!url) {
                                return proxy_real_protocol + "://" + proxy_real_host + "/";
                            }
                            const protocolMatch = url.match(
                                new RegExp(
                                    "^(http|https|ftp|file|data|javascript|mailto|tel|sms|ssh|vbscript|about|chrome|view-source|webcal|content)/",
                                    "i"
                                )
                            );
                            if (protocolMatch) {
                                const scheme = protocolMatch[1].toLowerCase();
                                const rest = url.substring(protocolMatch[0].length);
                                const absoluteUrl = scheme + "://" + rest;
                                try {
                                    const parsedUrl = new URL(absoluteUrl);
                                    if (parsedUrl.hostname === "localhost") {
                                        return input;
                                    }
                                    const href = parsedUrl.href;
                                    if (window.siteproxyLog) {
                                        window.siteproxyLog("[URLMeta.unrewrite] output:", href);
                                    }
                                    return href;
                                } catch (error) {
                                    console.error("URL unrewrite inner error:", error);
                                    const pathStart = rest.indexOf("/") !== -1 ? rest.indexOf("/") : rest.length;
                                    const host = rest.substring(0, pathStart);
                                    const path =
                                        pathStart < rest.length
                                            ? "/" + rest.substring(pathStart).replace(new RegExp("^/+", ""), "")
                                            : "";
                                    const url = scheme + "://" + host + path;
                                    if (window.siteproxyLog) {
                                        window.siteproxyLog("[URLMeta.unrewrite] output fallback:", url);
                                    }
                                    return url;
                                }
                            } else {
                                const rootPath = "/" + url.replace(new RegExp("^/+", ""), "");
                                const defaultUrl = proxy_real_protocol + "://" + proxy_real_host + rootPath;
                                if (window.siteproxyLog) {
                                    window.siteproxyLog("[URLMeta.unrewrite] output default:", defaultUrl);
                                }
                                return defaultUrl;
                            }
                        } catch (error) {
                            console.error("URL unrewrite error:", error);
                            return removeProxyPrefixFallback(input);
                        }
                    }
                }
                window.urlMeta = new URLMeta();
                function getHostFromProxyPrefixedURL(url) {
                    return new URLMeta().unrewrite(url).split("/")[2] || proxy_real_host;
                }
                window.getHostFromProxyPrefixedURL = getHostFromProxyPrefixedURL;
                function getPathnameFromProxyPrefixedURL(url) {
                    if (!url || typeof url !== "string") {
                        return "/";
                    }
                    if (!url.startsWith(proxy_url_prefix)) {
                        return "/";
                    }
                    try {
                        const unrewritten = window.urlMeta.unrewrite(url);
                        if (unrewritten.startsWith(proxy_url_prefix)) {
                            return "/";
                        }
                        const parsedUrl = new URL(unrewritten);
                        return parsedUrl.pathname || "/";
                    } catch (error) {
                        console.error("getPathnameFromProxyPrefixedURL error:", error);
                        const rest = url.substring(proxy_url_prefix.length);
                        const parts = rest.split("/");
                        if (parts.length > 2) {
                            const path = parts.slice(2).join("/").replace(new RegExp("^/+", ""), "");
                            return "/" + path;
                        }
                        return "/";
                    }
                }
                window.getPathnameFromProxyPrefixedURL = getPathnameFromProxyPrefixedURL;
                function getProtocolFromProxyPrefixedURL(url) {
                    if (!url || typeof url !== "string") {
                        return proxy_real_protocol;
                    }
                    const unrewritten = new URLMeta().unrewrite(url);
                    if (unrewritten.startsWith(proxy_url_prefix)) {
                        return proxy_real_protocol;
                    }
                    try {
                        return new URL(unrewritten).protocol.replace(":", "");
                    } catch (error) {
                        console.error("getProtocolFromProxyPrefixedURL error:", error);
                        return proxy_real_protocol;
                    }
                }
                window.getProtocolFromProxyPrefixedURL = getProtocolFromProxyPrefixedURL;
                function setProtocolFromProxyPrefixedURL(url, protocol) {
                    if (!url || typeof url !== "string") {
                        return url;
                    }
                    if (!url.startsWith(proxy_url_prefix)) {
                        return url;
                    }
                    try {
                        const unrewritten = window.urlMeta.unrewrite(url);
                        const parsedUrl = new URL(unrewritten);
                        if (protocol) {
                            if (protocol !== "http" && protocol !== "https") {
                                throw new Error("Invalid protocol: " + protocol);
                            }
                            parsedUrl.protocol = protocol + ":";
                        }
                        const host = parsedUrl.hostname + (parsedUrl.port ? ":" + parsedUrl.port : "");
                        const path = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
                        return proxy_url_prefix + parsedUrl.protocol.replace(":", "") + "/" + host + path;
                    } catch (error) {
                        console.error("setProtocol error:", error);
                        const rest = url.substring(proxy_url_prefix.length);
                        const parts = rest.split("/");
                        if (parts.length >= 1) {
                            parts[0] = protocol || parts[0];
                            return proxy_url_prefix + parts.join("/");
                        }
                        return url;
                    }
                }
                window.setProtocolFromProxyPrefixedURL = setProtocolFromProxyPrefixedURL;
            })();
            (function () {
                var originalWindowOpen = window.open;
                window.open = new Proxy(originalWindowOpen, {
                    apply(callback, thisArg, args) {
                        try {
                            let [url, target, features] = args;
                            args[0] = window.urlMeta.rewrite(url);
                            return Reflect.apply(callback, thisArg, args);
                        } catch (error) {
                            console.error("window.open trap error:", error);
                            return originalWindowOpen.apply(thisArg, args);
                        }
                    }
                });
                var originalPushState = History.prototype.pushState;
                var originalReplaceState = History.prototype.replaceState;
                if (window.siteproxyLog) {
                    window.siteproxyLog("[SiteProxy] Overriding History.pushState/replaceState");
                }
                console.log("[SiteProxy] Overriding History.pushState/replaceState");
                if (window.self === window.top) {
                    History.prototype.pushState = function (state, title, url) {
                        try {
                            console.log("[SiteProxy] pushState called", url);
                            if (window.siteproxyLog) {
                                window.siteproxyLog("[pushState] original url:", url);
                            }
                            url = window.urlMeta.rewrite(url);
                            if (window.siteproxyLog) {
                                window.siteproxyLog("[pushState] rewritten url:", url);
                            }
                            return originalPushState.call(this, state, title, url);
                        } catch (error) {
                            console.error("pushState trap error:", error);
                            return originalPushState.call(this, state, title, url);
                        }
                    };
                    History.prototype.replaceState = function (state, title, url) {
                        try {
                            console.log("[SiteProxy] replaceState called", url);
                            if (window.siteproxyLog) {
                                window.siteproxyLog("[replaceState] original url:", url);
                            }
                            url = window.urlMeta.rewrite(url);
                            if (window.siteproxyLog) {
                                window.siteproxyLog("[replaceState] rewritten url:", url);
                            }
                            return originalReplaceState.call(this, state, title, url);
                        } catch (error) {
                            console.error("replaceState trap error:", error);
                            return originalReplaceState.call(this, state, title, url);
                        }
                    };
                }
                History.prototype.___pushState = originalPushState;
                History.prototype.___replaceState = originalReplaceState;
                const originalLocation = window.location;
                function isInvalidLocationValue(value) {
                    if (value == null) {
                        return true;
                    }
                    if (typeof value === "object" && !(value instanceof URL)) {
                        try {
                            return String(value) === "[object Object]";
                        } catch (error) {
                            return true;
                        }
                    }
                    if (
                        typeof value === "string" &&
                        (value === "[object Object]" || value === "undefined" || value === "null")
                    ) {
                        return true;
                    }
                    return false;
                }
                class LocationWrapper {
                    constructor(location) {
                        this.originalLocation = location;
                    }
                    toString() {
                        return window.urlMeta.unrewrite(this.originalLocation.href);
                    }
                    assign(value) {
                        if (isInvalidLocationValue(value)) {
                            console.warn("[LocationWrapper.assign] rejecting non-URL value:", value);
                            return;
                        }
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[LocationWrapper.assign] original url:", value);
                        }
                        const rewritten = window.urlMeta.rewrite(value);
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[LocationWrapper.assign] rewritten url:", rewritten);
                        }
                        if (rewritten === this.originalLocation.href) {
                            return;
                        }
                        this.originalLocation.assign(rewritten);
                    }
                    reload(force = false) {
                        this.originalLocation.reload(force);
                    }
                    replace(value) {
                        if (isInvalidLocationValue(value)) {
                            console.warn("[LocationWrapper.replace] rejecting non-URL value:", value);
                            return;
                        }
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[LocationWrapper.replace] original url:", value);
                        }
                        const rewritten = window.urlMeta.rewrite(value);
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[LocationWrapper.replace] rewritten url:", rewritten);
                        }
                        if (rewritten === this.originalLocation.href) {
                            return;
                        }
                        this.originalLocation.replace(rewritten);
                    }
                    get href() {
                        const href = window.urlMeta.unrewrite(this.originalLocation.href);
                        return href;
                    }
                    set href(value) {
                        if (isInvalidLocationValue(value)) {
                            console.warn("[LocationWrapper.set href] rejecting non-URL value:", value);
                            return;
                        }
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[LocationWrapper.set href] original value:", value);
                        }
                        const rewritten = window.urlMeta.rewrite(value);
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[LocationWrapper.set href] rewritten:", rewritten);
                        }
                        if (rewritten === this.originalLocation.href) {
                            return;
                        }
                        this.originalLocation.href = rewritten;
                    }
                    get origin() {
                        return proxy_real_protocol + "://" + proxy_real_host;
                    }
                    get protocol() {
                        return getProtocolFromProxyPrefixedURL(this.originalLocation.href) + ":";
                    }
                    set protocol(value) {
                        const protocol = value.replace(":", "");
                        const newHref = setProtocolFromProxyPrefixedURL(this.originalLocation.href, protocol);
                        if (newHref === this.originalLocation.href) {
                            return;
                        }
                        this.originalLocation.href = newHref;
                    }
                    get pathname() {
                        return getPathnameFromProxyPrefixedURL(this.originalLocation.href);
                    }
                    set pathname(value) {}
                    get host() {
                        return getHostFromProxyPrefixedURL(this.originalLocation.href);
                    }
                    set host(value) {}
                    get search() {
                        return this.originalLocation.search;
                    }
                    set search(value) {}
                    get hash() {
                        return this.originalLocation.hash;
                    }
                    set hash(value) {
                        this.originalLocation.hash = value;
                    }
                    get hostname() {
                        let host = getHostFromProxyPrefixedURL(this.originalLocation.href);
                        const colonIndex = host.indexOf(":");
                        if (colonIndex !== -1) {
                            host = host.substring(0, colonIndex);
                        }
                        return host;
                    }
                    set hostname(value) {}
                    get port() {
                        const host = getHostFromProxyPrefixedURL(this.originalLocation.href);
                        const colonIndex = host.indexOf(":");
                        let port = "";
                        if (colonIndex !== -1) {
                            port = host.substring(colonIndex + 1);
                        }
                        return port;
                    }
                    set port(value) {}
                }
                let locationWrapper = new LocationWrapper(originalLocation);
                if (window.siteproxyLog) {
                    window.siteproxyLog("[SiteProxy] Creating LocationWrapper and assigning to window.___location");
                }
                console.log("[SiteProxy] Creating LocationWrapper and assigning to window.___location");
                window.___location = locationWrapper;
                document.___location = window.___location;
                Object.defineProperty(window, "___location", {
                    set: function (value) {
                        if (isInvalidLocationValue(value)) {
                            console.warn("[window.___location setter] rejecting non-URL value:", value);
                            return;
                        }
                        const stringValue = String(value);
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[window.___location setter] original:", stringValue);
                        }
                        const rewritten = window.urlMeta.rewrite(stringValue);
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[window.___location setter] rewritten:", rewritten);
                        }
                        if (rewritten === locationWrapper.originalLocation.href) {
                            return;
                        }
                        locationWrapper.originalLocation.href = rewritten;
                    },
                    get: function () {
                        return locationWrapper;
                    },
                    configurable: true
                });
                Object.defineProperty(document, "___location", {
                    set: function (value) {
                        if (isInvalidLocationValue(value)) {
                            console.warn("[document.___location setter] rejecting non-URL value:", value);
                            return;
                        }
                        const stringValue = String(value);
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[document.___location setter] original:", stringValue);
                        }
                        const rewritten = window.urlMeta.rewrite(stringValue);
                        if (window.siteproxyLog) {
                            window.siteproxyLog("[document.___location setter] rewritten:", rewritten);
                        }
                        if (rewritten === locationWrapper.originalLocation.href) {
                            return;
                        }
                        locationWrapper.originalLocation.href = rewritten;
                    },
                    get: function () {
                        return locationWrapper;
                    },
                    configurable: true
                });
                window.___location = new Proxy(window.___location, {
                    get(target, property) {
                        if (property in target) {
                            const property = target[property];
                            if (typeof property === "function") {
                                return property.bind(target);
                            } else {
                                return property;
                            }
                        }
                        return originalLocation[property];
                    },
                    set(target, property, value) {
                        if (property in target) {
                            target[property] = value;
                            return true;
                        }
                        originalLocation[property] = value;
                        return true;
                    }
                });
                Object.defineProperty(document, "URL", {
                    get() {
                        return window.___location.href;
                    },
                    set(value) {
                        window.___location.href = window.urlMeta.rewrite(value);
                    },
                    configurable: true
                });
                try {
                    delete document.___domain;
                    Object.defineProperty(document, "___domain", {
                        get: function () {
                            return getHostFromProxyPrefixedURL(document.URL);
                        },
                        set: function (value) {},
                        configurable: true
                    });
                } catch (domainError) {
                    console.warn("Failed to define document.___domain:", domainError);
                }
                try {
                    Object.defineProperty(document, "domain", {
                        get: function () {
                            return getHostFromProxyPrefixedURL(document.URL);
                        },
                        set: function (value) {},
                        configurable: true
                    });
                } catch (documentDomainError) {
                    console.warn("Failed to define document.domain:", documentDomainError);
                }
                try {
                    delete navigator.___serviceWorker;
                    Object.defineProperty(navigator, "___serviceWorker", {
                        value: (() => {
                            const blockedError = new DOMException(
                                "Service worker registration blocked by proxy",
                                "NotAllowedError"
                            );
                            const neverPromise = new Promise((resolve, reject) => {});
                            neverPromise.catch(() => {});
                            const serviceWorkerStub = {
                                controller: null,
                                ready: neverPromise,
                                onmessage: null,
                                oncontrollerchange: null,
                                register: function (scriptURL, options) {
                                    return Promise.reject(blockedError);
                                },
                                getRegistrations: function () {
                                    return Promise.resolve([]);
                                },
                                addEventListener: function (eventType, listener, options) {},
                                removeEventListener: function (eventType, listener, options) {},
                                dispatchEvent: function (event) {
                                    return true;
                                }
                            };
                            Object.defineProperty(serviceWorkerStub, "controller", {
                                value: null,
                                writable: false,
                                configurable: false
                            });
                            return serviceWorkerStub;
                        })(),
                        writable: false,
                        configurable: true
                    });
                } catch (serviceWorkerError) {
                    console.warn("Failed to define navigator.___serviceWorker:", serviceWorkerError);
                }
                try {
                    delete document.___requestStorageAccessFor;
                    Object.defineProperty(document, "___requestStorageAccessFor", {
                        value: function () {
                            return Promise.reject(
                                new DOMException("requestStorageAccessFor blocked by proxy", "NotAllowedError")
                            );
                        },
                        writable: false,
                        configurable: true
                    });
                } catch (storageAccessError) {
                    console.warn("Failed to define document.___requestStorageAccessFor:", storageAccessError);
                }
                ["HTMLScriptElement", "HTMLImageElement", "HTMLIFrameElement"].forEach((elementName) => {
                    const prototype = window[elementName]?.prototype;
                    if (prototype) {
                        const descriptor = Object.getOwnPropertyDescriptor(prototype, "src");
                        if (descriptor && descriptor.set) {
                            Object.defineProperty(prototype, "src", {
                                get: descriptor.get,
                                set: function (value) {
                                    const rewritten = window.urlMeta.rewrite(value);
                                    descriptor.set.call(this, rewritten);
                                },
                                configurable: true,
                                enumerable: descriptor.enumerable
                            });
                        }
                    }
                });
                if (typeof window.fetch === "function") {
                    var originalFetch = window.fetch;
                    window.fetch = new Proxy(originalFetch, {
                        apply(callback, thisArg, args) {
                            try {
                                let [input, init] = args;
                                const referer = getRefererFromLocation(
                                    window.location.href,
                                    proxy_real_protocol,
                                    proxy_real_host
                                );
                                const headers = new Headers();
                                if (input instanceof Request) {
                                    input.headers.forEach((value, key) => headers.append(key, value));
                                }
                                if (init && init.headers) {
                                    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
                                }
                                headers.set("siteproxy-target-protocol", proxy_real_protocol);
                                headers.set("siteproxy-target-host", proxy_real_host);
                                headers.set("siteproxy-real-referer", referer);
                                headers.set("siteproxy-window-location-pathname", window.___location.pathname);
                                let requestInput = input;
                                try {
                                    if (typeof input === "string") {
                                        requestInput = window.urlMeta.rewrite(input);
                                    } else if (input instanceof Request) {
                                        requestInput = new Request(window.urlMeta.rewrite(input.url), init || input);
                                    } else if (input instanceof URL) {
                                        requestInput = window.urlMeta.rewrite(input.href);
                                    }
                                } catch (error) {
                                    requestInput = input;
                                }
                                args[0] = requestInput;
                                if (init) {
                                    init.headers = headers;
                                } else {
                                    args[1] = {
                                        headers: headers
                                    };
                                }
                                return Reflect.apply(callback, thisArg, args);
                            } catch (error) {
                                console.error("fetch trap error:", error);
                                if (args[1]) {
                                    const headers = args[1].headers ? new Headers(args[1].headers) : new Headers();
                                    headers.set("siteproxy-target-protocol", proxy_real_protocol);
                                    headers.set("siteproxy-target-host", proxy_real_host);
                                    args[1].headers = headers;
                                } else {
                                    args[1] = {
                                        headers: new Headers()
                                    };
                                    args[1].headers.set("siteproxy-target-protocol", proxy_real_protocol);
                                    args[1].headers.set("siteproxy-target-host", proxy_real_host);
                                }
                                return Reflect.apply(callback, thisArg, args);
                            }
                        }
                    });
                }
                var originalXhrOpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function (method, url, ...args) {
                    try {
                        url = window.urlMeta.rewrite(url);
                        originalXhrOpen.call(this, method, url, ...args);
                        this.setRequestHeader("siteproxy-target-protocol", proxy_real_protocol);
                        this.setRequestHeader("siteproxy-target-host", proxy_real_host);
                        const referer = getRefererFromLocation(
                            window.location.href,
                            proxy_real_protocol,
                            proxy_real_host
                        );
                        this.setRequestHeader("siteproxy-real-referer", referer);
                        this.setRequestHeader("siteproxy-window-location-pathname", window.___location.pathname);
                    } catch (error) {
                        console.error("XHR open trap error:", error);
                        originalXhrOpen.call(this, method, url, ...args);
                    }
                };
                if (typeof navigator.sendBeacon === "function") {
                    var originalSendBeacon = navigator.sendBeacon;
                    navigator.sendBeacon = function (url, ...data) {
                        try {
                            return originalSendBeacon.call(navigator, window.urlMeta.rewrite(String(url)), ...data);
                        } catch (error) {
                            console.error("sendBeacon trap error:", error);
                            return originalSendBeacon.call(navigator, url, ...data);
                        }
                    };
                }
            })();
            (function () {
                const isCloudflareBeacon = (node) =>
                    node &&
                    node.nodeType === 1 &&
                    node.tagName === "SCRIPT" &&
                    (node.hasAttribute("data-cf-beacon") ||
                        (node.getAttribute("src") || "").indexOf("static.cloudflareinsights.com") !== -1);
                const removeNode = (node) => {
                    try {
                        node.remove();
                    } catch (error) {
                        console.warn("Failed to remove Cloudflare beacon:", error);
                    }
                };
                document
                    .querySelectorAll('script[data-cf-beacon], script[src*="cloudflareinsights"]')
                    .forEach(removeNode);
                new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (isCloudflareBeacon(node)) {
                                removeNode(node);
                            }
                        }
                    }
                }).observe(document.documentElement, {
                    childList: true,
                    subtree: true
                });
            })();
            (function () {
                const observedAttributes = [
                    "src",
                    "href",
                    "action",
                    "data-url",
                    "srcset",
                    "imagesrcset",
                    "data-src",
                    "poster",
                    "cite",
                    "manifest",
                    "style"
                ];
                const observerOptions = {
                    attributes: true,
                    childList: true,
                    subtree: true,
                    attributeOldValue: true,
                    characterDataOldValue: true,
                    attributeFilter: observedAttributes
                };
                const rewriteStyleUrl = (value) =>
                    String(value).replace(
                        /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi,
                        (fullMatch, quote, url) => "url(" + quote + window.urlMeta.rewrite(url.trim()) + quote + ")"
                    );
                const srcsetAttributes = ["srcset", "imagesrcset"];
                const rewriteAttributeValue = (name, value) => {
                    const lowerName = String(name).toLowerCase();
                    if (lowerName === "style") {
                        if (typeof value === "string") {
                            return rewriteStyleUrl(value);
                        } else {
                            return value;
                        }
                    }
                    if (srcsetAttributes.indexOf(lowerName) === -1) {
                        return window.urlMeta.rewrite(value);
                    }
                    const srcset = String(value);
                    const isBlank = (value) => value.trim() === "";
                    let result = "";
                    let index = 0;
                    while (index < srcset.length) {
                        const start = index;
                        while (index < srcset.length && (isBlank(srcset[index]) || srcset[index] === ",")) {
                            index++;
                        }
                        result += srcset.slice(start, index);
                        if (index >= srcset.length) {
                            break;
                        }
                        const tokenStart = index;
                        while (index < srcset.length && !isBlank(srcset[index])) {
                            index++;
                        }
                        let candidate = srcset.slice(tokenStart, index);
                        let trailingCommas = "";
                        while (candidate.endsWith(",")) {
                            candidate = candidate.slice(0, -1);
                            trailingCommas += ",";
                        }
                        result += window.urlMeta.rewrite(candidate) + trailingCommas;
                        if (trailingCommas) {
                            continue;
                        }
                        const commaStart = index;
                        while (index < srcset.length && srcset[index] !== ",") {
                            index++;
                        }
                        result += srcset.slice(commaStart, index);
                    }
                    return result;
                };
                (function () {
                    const urlAttributes = [
                        "src",
                        "href",
                        "action",
                        "poster",
                        "data",
                        "cite",
                        "srcset",
                        "data-src",
                        "manifest",
                        "style"
                    ];
                    const elementClasses = [
                        "HTMLElement",
                        "HTMLImageElement",
                        "HTMLAnchorElement",
                        "HTMLScriptElement",
                        "HTMLLinkElement",
                        "HTMLFormElement",
                        "HTMLSourceElement",
                        "HTMLVideoElement",
                        "HTMLObjectElement",
                        "HTMLQuoteElement",
                        "HTMLModElement"
                    ];
                    elementClasses.forEach((className) => {
                        const prototype = window[className] ? window[className].prototype : null;
                        if (!prototype) {
                            return;
                        }
                        urlAttributes.forEach((attribute) => {
                            const descriptor = Object.getOwnPropertyDescriptor(prototype, attribute);
                            if (descriptor && descriptor.set) {
                                Object.defineProperty(prototype, attribute, {
                                    set(value) {
                                        const rewritten = rewriteAttributeValue(attribute, value);
                                        return descriptor.set.call(this, rewritten);
                                    },
                                    get: descriptor.get,
                                    configurable: true,
                                    enumerable: descriptor.enumerable
                                });
                            }
                        });
                    });
                })();
                const OriginalImage = window.Image;
                window.Image = function (...args) {
                    const image = new OriginalImage(...args);
                    return image;
                };
                const originalCreateElement = Document.prototype.createElement;
                Document.prototype.createElement = function (tagName, options) {
                    const element = originalCreateElement.call(this, tagName, options);
                    return element;
                };
                function debounce(fn, delay) {
                    let timer;
                    return (...args) => {
                        clearTimeout(timer);
                        timer = setTimeout(() => fn(...args), delay);
                    };
                }
                var originalSetAttribute = Element.prototype.setAttribute;
                Element.prototype.setAttribute = new Proxy(originalSetAttribute, {
                    apply(callback, thisArg, args) {
                        try {
                            let [attribute, value] = args;
                            if (observedAttributes.includes(attribute) && value) {
                                value = rewriteAttributeValue(attribute, value);
                                if (thisArg.tagName.toLowerCase() === "script" && thisArg.hasAttribute("integrity")) {
                                    thisArg.removeAttribute("integrity");
                                }
                            }
                            args[1] = value;
                            return Reflect.apply(callback, thisArg, args);
                        } catch (error) {
                            console.error("setAttribute trap error:", error);
                            return originalSetAttribute.call(thisArg, attr, value);
                        }
                    }
                });
                var innerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
                if (innerHtmlDescriptor && innerHtmlDescriptor.set) {
                    Object.defineProperty(Element.prototype, "innerHTML", {
                        set: function (value) {
                            innerHtmlDescriptor.set.call(this, value);
                            for (let child of this.children) {
                                traverseAndModifyNode(child);
                            }
                        },
                        get: innerHtmlDescriptor.get,
                        configurable: true,
                        enumerable: innerHtmlDescriptor.enumerable
                    });
                }
                var outerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "outerHTML");
                if (outerHtmlDescriptor && outerHtmlDescriptor.set) {
                    Object.defineProperty(Element.prototype, "outerHTML", {
                        set: function (value) {
                            outerHtmlDescriptor.set.call(this, value);
                        },
                        get: outerHtmlDescriptor.get,
                        configurable: true,
                        enumerable: outerHtmlDescriptor.enumerable
                    });
                }
                var originalCloneNode = Node.prototype.cloneNode;
                Node.prototype.cloneNode = function (deep) {
                    var clone = originalCloneNode.call(this, deep);
                    traverseAndModifyNode(clone);
                    return clone;
                };
                var originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
                Element.prototype.insertAdjacentHTML = function (position, html) {
                    var container = document.createElement("div");
                    container.innerHTML = html;
                    traverseAndModifyNode(container);
                    var rewrittenHtml = container.innerHTML;
                    return originalInsertAdjacentHTML.call(this, position, rewrittenHtml);
                };
                function createObserver(callback) {
                    return debounce((mutations, observer) => {
                        observer.disconnect();
                        mutations.forEach((mutation) => {
                            if (mutation.type === "attributes" && observedAttributes.includes(mutation.attributeName)) {
                                let attributeValue = mutation.target.getAttribute(mutation.attributeName);
                                let rewrittenValue = rewriteAttributeValue(mutation.attributeName, attributeValue);
                                if (rewrittenValue !== attributeValue) {
                                    mutation.target.setAttribute(mutation.attributeName, rewrittenValue);
                                }
                                if (
                                    mutation.attributeName === "src" &&
                                    mutation.target.tagName.toLowerCase() === "script"
                                ) {
                                    mutation.target.removeAttribute("integrity");
                                }
                            } else if (mutation.type === "childList") {
                                mutation.addedNodes.forEach((node) => traverseAndModifyNode(node));
                            }
                        });
                        observer.observe(callback, observerOptions);
                    }, 10);
                }
                window.debouncedAttributeChanged = createObserver(document.documentElement);
                function traverseAndModifyNode(node) {
                    if (node._traversed) {
                        return;
                    }
                    node._traversed = true;
                    node.childNodes.forEach(traverseAndModifyNode);
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        observedAttributes.forEach((attribute) => {
                            if (node.hasAttribute(attribute)) {
                                let value = node.getAttribute(attribute);
                                let rewritten = rewriteAttributeValue(attribute, value);
                                if (rewritten !== value) {
                                    node.setAttribute(attribute, rewritten);
                                }
                                if (attribute === "src" && node.tagName.toLowerCase() === "script") {
                                    node.removeAttribute("integrity");
                                }
                            }
                        });
                    }
                    if (node.tagName && node.tagName.toLowerCase() === "iframe" && !node._loadListenerAdded) {
                        node._loadListenerAdded = true;
                        node.addEventListener("load", () => {
                            if (node.contentDocument && !node.contentDocument._observerSet) {
                                node.contentDocument._observerSet = true;
                                traverseAndModifyNode(node.contentDocument);
                                if (node.contentDocument.documentElement) {
                                    let observer = new MutationObserver(
                                        createObserver(node.contentDocument.documentElement)
                                    );
                                    observer.observe(node.contentDocument.documentElement, observerOptions);
                                }
                            }
                        });
                    }
                    if (node.tagName && node.tagName.toLowerCase() === "iframe") {
                        const contentDocument = node.contentDocument;
                        if (contentDocument && !contentDocument._observerSet) {
                            contentDocument._observerSet = true;
                            traverseAndModifyNode(contentDocument);
                            if (contentDocument.documentElement) {
                                let observer = new MutationObserver(createObserver(contentDocument.documentElement));
                                observer.observe(contentDocument.documentElement, observerOptions);
                            }
                        }
                    }
                }
                window.traverseAndModifyNode = traverseAndModifyNode;
            })();
            (function () {
                console.log("[SiteProxy] Service Worker section starting");
                function postCurrentLocation() {
                    if (!proxy_real_protocol || window.self !== window.top) {
                        return;
                    }
                    if (window.proxy_worker_registration && window.proxy_worker_registration.active) {
                        window.proxy_worker_registration.active.postMessage({
                            type: "PROXY_CUR_LOCATION",
                            data: {
                                protocol: proxy_real_protocol,
                                host: proxy_real_host
                            }
                        });
                    }
                }
                if ("serviceWorker" in navigator) {
                    console.log("[SiteProxy] Service worker supported, checking registrations");
                    var serviceWorkerRegistrations;
                    navigator.serviceWorker
                        .getRegistrations()
                        .then(function (registrations) {
                            serviceWorkerRegistrations = registrations;
                            console.log("[SiteProxy] Number of registrations:", serviceWorkerRegistrations.length);
                            var hasRegistration = serviceWorkerRegistrations.some(function (registration) {
                                if (
                                    registration.active &&
                                    registration.active.scriptURL.includes("siteproxy_service_worker.js")
                                ) {
                                    console.log("!!! proxy service worker already registered.");
                                    window.proxy_worker_registration = registration;
                                    postCurrentLocation();
                                    Promise.resolve()
                                        .then(() => registration.update())
                                        .catch((error) => {
                                            console.warn("Failed to update proxy service worker registration:", error);
                                        });
                                    return true;
                                }
                                return false;
                            });
                            if (!hasRegistration) {
                                if (window.proxy_worker_registration && window.proxy_worker_registration.active) {
                                    return;
                                }
                                navigator.serviceWorker.getRegistrations().then(function (registrations) {
                                    registrations.forEach(function (registration) {
                                        let registrationScope;
                                        try {
                                            registrationScope = new URL(registration.scope).pathname;
                                        } catch (error) {
                                            console.warn("Invalid service worker scope:", registration.scope, error);
                                            return;
                                        }
                                        if (
                                            registrationScope === "/" &&
                                            registration.active &&
                                            registration.active.scriptURL.indexOf("siteproxy_service_worker.js") !== -1
                                        ) {
                                            registration.unregister().catch((error) => {
                                                console.warn("Failed to unregister root service worker:", error);
                                            });
                                        }
                                    });
                                });
                                const serviceWorkerPrefix = config_token_prefix.endsWith("/")
                                    ? config_token_prefix
                                    : config_token_prefix + "/";
                                const serviceWorkerPath = serviceWorkerPrefix + "siteproxy_service_worker.js";
                                navigator.serviceWorker
                                    .register(
                                        serviceWorkerPath +
                                            "?proxy_real_protocol=" +
                                            encodeURIComponent(proxy_real_protocol) +
                                            "&proxy_real_host=" +
                                            encodeURIComponent(proxy_real_host) +
                                            "&v=4"
                                    )
                                    .then(
                                        function (registration) {
                                            console.log(
                                                "siteproxy_service_worker registration successful with scope: ",
                                                registration.scope,
                                                "protocol:",
                                                proxy_real_protocol,
                                                "host:",
                                                proxy_real_host
                                            );
                                            window.proxy_worker_registration = registration;
                                            postCurrentLocation();
                                        },
                                        function (error) {
                                            console.error("siteproxy_service_worker registration failed: ", error);
                                        }
                                    );
                            }
                        })
                        .catch(function (error) {
                            console.error("SW get reg error:", error);
                        });
                }
            })();
            (function () {
                window.cookieInterceptionRan = true;
                let proxyTokenPrefix = config_token_prefix;
                if (!proxyTokenPrefix.endsWith("/")) {
                    proxyTokenPrefix += "/";
                }
                proxyTokenPrefix += proxy_real_protocol + "/" + proxy_real_host + "/";
                if (!proxyTokenPrefix.startsWith("/")) {
                    proxyTokenPrefix = "/" + proxyTokenPrefix;
                }
                let proxyHost = config_proxy_url.substring(config_proxy_url.indexOf("//") + 2);
                if (proxyHost.indexOf(":") !== -1) {
                    proxyHost = proxyHost.substring(0, proxyHost.indexOf(":"));
                }
                const slashIndex = proxyHost.indexOf("/");
                if (slashIndex !== -1) {
                    proxyHost = proxyHost.substring(0, slashIndex);
                }
                console.log("[SiteProxy] cookiePath:", proxyTokenPrefix, "proxy_host:", proxyHost);
                let proxyCookies = new Set();
                function isExpired(timestamp) {
                    const lastTime = new Date(timestamp);
                    const now = new Date();
                    return lastTime < now;
                }
                function rewriteCookie(cookie) {
                    console.log("[SiteProxy] clientCookieModify called with:", cookie);
                    const nameMatch = cookie.match(/^([^=]+)=/);
                    const cookieName = nameMatch ? nameMatch[1] : "";
                    const isProxyCookie = cookieName === "proxy_real_host" || cookieName === "proxy_real_protocol";
                    if (!isProxyCookie) {
                        proxyCookies.add(cookieName);
                    }
                    const hasExpires = /Expires\s*=/i.test(cookie);
                    const hasMaxAge = /Max-Age\s*=/i.test(cookie);
                    let rewritten = cookie.replace(/Domain\s*=\s*[^;]*?(;|$)/gi, "Domain=" + proxyHost + ";");
                    const pathMatch = cookie.match(/Path\s*=\s*([^;]*)(;|$)/i);
                    let cookiePath = pathMatch ? pathMatch[1].trim() : "/";
                    if (!cookiePath.startsWith("/")) {
                        cookiePath = "/" + cookiePath;
                    }
                    let newPath;
                    if (isProxyCookie) {
                        newPath = "/";
                    } else if (cookiePath === "/") {
                        newPath = proxyTokenPrefix;
                    } else {
                        const tokenPrefixWithoutSlash = proxyTokenPrefix.endsWith("/")
                            ? proxyTokenPrefix.slice(0, -1)
                            : proxyTokenPrefix;
                        if (
                            cookiePath.startsWith(tokenPrefixWithoutSlash) &&
                            (cookiePath.length === tokenPrefixWithoutSlash.length ||
                                cookiePath[tokenPrefixWithoutSlash.length] === "/")
                        ) {
                            newPath = cookiePath;
                        } else {
                            newPath = proxyTokenPrefix.slice(0, -1) + cookiePath;
                        }
                    }
                    if (/Path\s*=/i.test(rewritten)) {
                        rewritten = rewritten.replace(/Path\s*=\s*([^;]*)(;|$)/gi, "Path=" + newPath + ";");
                    } else {
                        rewritten += "; Path=" + newPath + ";";
                    }
                    if (!/Domain\s*=/i.test(rewritten)) {
                        rewritten += "; Domain=" + proxyHost + ";";
                    }
                    if (!isProxyCookie) {
                        rewritten = rewritten.replace(/Max-Age\s*=\s*[^;]*?(;|$)/gi, "");
                        const expiresMatch = rewritten.match(/Expires\s*=\s*([^;]*?)(;|$)/i);
                        if (expiresMatch) {
                            const expiresValue = expiresMatch[1];
                            if (!isExpired(expiresValue)) {
                                rewritten = rewritten.replace(/Expires\s*=\s*([^;]*?)(;|$)/gi, "");
                                rewritten += "; Max-Age=1800";
                            }
                        } else if (!hasExpires && !hasMaxAge) {
                            rewritten += "; Max-Age=1800";
                        }
                    }
                    rewritten = rewritten.replace(/; ;|;;/g, ";");
                    console.log("[SiteProxy] clientCookieModify returning:", rewritten);
                    return rewritten;
                }
                const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
                if (cookieDescriptor) {
                    const originalCookieGetter = cookieDescriptor.get;
                    const originalCookieSetter = cookieDescriptor.set;
                    function removeRootPathCookies() {
                        try {
                            const cookieString = originalCookieGetter.call(document);
                            if (!cookieString) {
                                return;
                            }
                            const cookies = cookieString.split("; ");
                            for (let cookie of cookies) {
                                const equalsIndex = cookie.indexOf("=");
                                if (equalsIndex === -1) {
                                    continue;
                                }
                                const cookieName = cookie.substring(0, equalsIndex);
                                if (cookieName === "proxy_real_host" || cookieName === "proxy_real_protocol") {
                                    continue;
                                }
                                if (proxyCookies.has(cookieName)) {
                                    continue;
                                }
                                const expiredCookie =
                                    cookieName +
                                    "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=" +
                                    proxyHost;
                                originalCookieSetter.call(document, expiredCookie);
                            }
                        } catch (error) {
                            console.error("[SiteProxy] removeRootPathCookies error:", error);
                        }
                    }
                    Object.defineProperty(document, "cookie", {
                        get: originalCookieGetter,
                        set: function (cookie) {
                            const rewritten = rewriteCookie(cookie);
                            console.log("[SiteProxy] cookie setter modified:", rewritten);
                            try {
                                const result = originalCookieSetter.call(this, rewritten);
                                removeRootPathCookies();
                                return result;
                            } catch (error) {
                                console.error("[SiteProxy] cookie setter error:", error);
                                throw error;
                            }
                        },
                        configurable: true,
                        enumerable: cookieDescriptor.enumerable
                    });
                }
                document.cookie = "proxy_real_host=" + proxy_real_host + "; path=/; max-age=3600";
                document.cookie = "proxy_real_protocol=" + proxy_real_protocol + "; path=/; max-age=3600";
            })();
            (function () {
                function delay(milliseconds) {
                    return new Promise((resolve) => setTimeout(resolve, milliseconds));
                }
                window.delay = delay;
                function showTopBar() {
                    var lastShown = localStorage ? localStorage.getItem("topBarLastShown") : null;
                    var now = new Date().getTime();
                    if (lastShown && now - parseInt(lastShown) < 86400000) {
                        return;
                    }
                    var topBar = document.createElement("div");
                    topBar.style.position = "fixed";
                    topBar.style.top = "0";
                    topBar.style.left = "0";
                    topBar.style.width = "100%";
                    topBar.style.backgroundColor = "#ff0000";
                    topBar.style.color = "#ffffff";
                    topBar.style.textAlign = "center";
                    topBar.style.fontSize = "13px";
                    topBar.style.lineHeight = "20px";
                    topBar.style.fontWeight = "bold";
                    topBar.style.zIndex = "10000";
                    topBar.style.padding = "5px 0";
                    var closeButton = document.createElement("span");
                    closeButton.innerHTML = "&times;";
                    closeButton.style.position = "absolute";
                    closeButton.style.right = "10px";
                    closeButton.style.top = "50%";
                    closeButton.style.transform = "translateY(-50%)";
                    closeButton.style.cursor = "pointer";
                    closeButton.style.fontSize = "20px";
                    closeButton.style.lineHeight = "20px";
                    closeButton.onclick = function () {
                        topBar.style.display = "none";
                        document.body.style.marginTop = "0";
                        if (localStorage) {
                            localStorage.setItem("topBarLastShown", now.toString());
                        }
                    };
                    topBar.innerHTML =
                        '!!! This is a SiteProxy proxied website, do not enter your personal information. Refer to: <a href="https://github.com/netptop/siteproxy" target="_blank" style="color: #ffffff; text-decoration: underline;">https://github.com/netptop/siteproxy</a> for details !!!';
                    topBar.appendChild(closeButton);
                    document.body.insertBefore(topBar, document.body.firstChild);
                    document.body.style.marginTop = topBar.offsetHeight + "px";
                }
                if (window.___location.pathname.includes("github.com")) {
                    setTimeout(() => {
                        var form = document.querySelector("form");
                        if (form) {
                            form.addEventListener("submit", function (event) {
                                event.preventDefault();
                                const formAction = event.target.action;
                                const formMethod = event.target.method || "POST";
                                const formData = new FormData(event.target);
                                let headers = {};
                                fetch(formAction, {
                                    method: formMethod,
                                    body: formData,
                                    headers: headers
                                })
                                    .then((response) => {
                                        window.location.href = response.url;
                                    })
                                    .catch((error) => {
                                        console.error("Error in form submission fetch", error);
                                    });
                            });
                        }
                    }, 4000);
                }
                function restoreBingVisibility() {
                    let observed = false;
                    function checkVisibility() {
                        if (observed) {
                            return;
                        }
                        const href = window.___location.href;
                        const isYouTube =
                            href.includes("www.youtube.com/watch?v=") || href.includes("m.youtube.com/watch?v=");
                        if (!isYouTube) {
                            return;
                        }
                        if (window.history && window.history.state && window.history.state.ytRedirected) {
                            const historyState = window.history.state;
                            if (historyState.timestamp && Date.now() - historyState.timestamp < 2000) {
                                return;
                            }
                            window.history.replaceState(
                                {
                                    ...historyState,
                                    ytRedirected: false,
                                    timestamp: undefined
                                },
                                "",
                                window.___location.href
                            );
                            return;
                        }
                        if (window.history) {
                            const newState = {
                                ...window.history.state,
                                ytRedirected: true,
                                timestamp: Date.now()
                            };
                            window.history.replaceState(newState, "", window.___location.href);
                        }
                        observed = true;
                        let redirectUrl = href
                            .replace("www.youtube.com/watch?v=", "www.netptop.com/youtube/watch/index.html?v=")
                            .replace("m.youtube.com/watch?v=", "www.netptop.com/youtube/watch/index.html?v=");
                        window.___location.assign(redirectUrl);
                    }
                    const observer = new MutationObserver(checkVisibility);
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                    setInterval(checkVisibility, 2000);
                }
                window.addEventListener("load", () => {
                    const pathname = window.___location.pathname;
                    const search = window.___location.search;
                    const hash = window.___location.hash;
                    const href = window.___location.href;
                    if (
                        window.self === window.top &&
                        pathname === "/" &&
                        search === "" &&
                        hash === "" &&
                        !href.endsWith("/")
                    ) {
                        window.___location.href = href + "/";
                    }
                });
                if (typeof getHostFromProxyPrefixedURL === "function") {
                    try {
                        const host = getHostFromProxyPrefixedURL(window.___location.href);
                        if (host && host.indexOf("bing.com") !== -1) {
                            const restoreVisibility = () => {
                                const content = document.getElementById("b_content");
                                if (content && content.style.visibility === "hidden") {
                                    content.style.visibility = "visible";
                                }
                            };
                            document.addEventListener("DOMContentLoaded", restoreVisibility);
                            window.addEventListener("load", restoreVisibility);
                            setTimeout(restoreVisibility, 100);
                            setTimeout(restoreVisibility, 500);
                            setTimeout(restoreVisibility, 1500);
                        }
                    } catch (error) {
                        console.warn("Failed to configure Bing visibility restoration:", error);
                    }
                }
                document.addEventListener("DOMContentLoaded", () => {
                    traverseAndModifyNode(document.documentElement);
                    showTopBar();
                    restoreBingVisibility();
                });
                window.siteproxyAttributeChanged = window.debouncedAttributeChanged;
                window.removeProxyPrefix = (url) => window.urlMeta.unrewrite(url);
                window.siteproxyRegReplacement = (url) => window.urlMeta.rewrite(url);
            })();
        } catch (error) {
            console.error("siteproxy injection error", error, error && error.stack, "typeof:", typeof error);
        }
    }
}).call(typeof window !== "undefined" ? window : globalThis);
