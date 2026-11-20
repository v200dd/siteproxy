/**
 * HTML/JavaScript/CSS rewriting.
 *
 * Rewrites absolute and relative URLs to the proxy prefix, removes integrity
 * attributes where content is modified, and handles srcset/style URLs. The
 * functions here treat the upstream body as untrusted text.
 */

import { DEFAULT_TOKEN_PREFIX, isLoginHost } from "../config.mjs";

// Replace identifiers while preserving strings, comments, regex literals, and
// template literals. This is a small tokenizer, not a full JS parser.
function rewriteJavaScript(source, pattern, replacement) {
    let length = source.length;
    let index = 0;
    let copyIndex = 0;
    let result = "";
    let previousToken = ";";
    let expressionChars = "(,;:!&|?=+-*~<>{}[]^%";
    let keywordSet = new Set([
        "return",
        "throw",
        "typeof",
        "delete",
        "instanceof",
        "in",
        "of",
        "new",
        "void",
        "yield",
        "await",
        "case",
        "do",
        "else"
    ]);
    function emitReplaced(end) {
        if (copyIndex < end) {
            result += source.slice(copyIndex, end).replace(pattern, replacement);
        }
        copyIndex = end;
    }
    function emitRaw(end) {
        if (copyIndex < end) {
            result += source.slice(copyIndex, end);
        }
        copyIndex = end;
    }
    function isAfterKeyword(position) {
        let cursor = position - 1;
        while (cursor >= 0 && /[\s\n\r\t]/.test(source[cursor])) {
            cursor--;
        }
        if (cursor < 0 || !/[a-zA-Z_$]/.test(source[cursor])) {
            return false;
        }
        let wordEnd = cursor + 1;
        while (cursor >= 0 && /[a-zA-Z0-9_$]/.test(source[cursor])) {
            cursor--;
        }
        let word = source.slice(cursor + 1, wordEnd);
        return !!keywordSet.has(word) && (!(cursor >= 0) || source[cursor] !== ".");
    }
    while (index < length) {
        let char = source[index];
        if (char === "/" && source[index + 1] === "*") {
            emitReplaced(index);
            let blockCommentEnd = index + 2;
            while (blockCommentEnd < length) {
                if (source[blockCommentEnd] === "*" && source[blockCommentEnd + 1] === "/") {
                    blockCommentEnd += 2;
                    break;
                }
                blockCommentEnd++;
            }
            emitRaw(blockCommentEnd);
            index = blockCommentEnd;
            previousToken = "/";
            continue;
        }
        if (char === "/" && (expressionChars.indexOf(previousToken) !== -1 || isAfterKeyword(index))) {
            let regexScanEnd = index + 1;
            let inCharClass = false;
            let regexEnd = -1;
            while (regexScanEnd < length) {
                let scanChar = source[regexScanEnd];
                if (scanChar === "\\" && regexScanEnd + 1 < length) {
                    regexScanEnd += 2;
                    continue;
                }
                if (scanChar === "\n") {
                    break;
                }
                if (scanChar === "[") {
                    inCharClass = true;
                } else if (scanChar === "]") {
                    inCharClass = false;
                } else if (scanChar === "/" && !inCharClass) {
                    regexEnd = regexScanEnd;
                    break;
                }
                regexScanEnd++;
            }
            if (regexEnd > 0) {
                let flagsEnd = regexEnd + 1;
                while (flagsEnd < length && /[gimsuy]/.test(source[flagsEnd])) {
                    flagsEnd++;
                }
                let nextChar = source[flagsEnd];
                if (nextChar === undefined || /[\s)\],;:!&|?+\-*=<>}.]/.test(nextChar)) {
                    emitReplaced(index);
                    emitRaw(flagsEnd);
                    index = flagsEnd;
                    previousToken = "/";
                    continue;
                }
            }
        }
        if (char === "/" && source[index + 1] === "/") {
            emitReplaced(index);
            let lineCommentEnd = index + 2;
            while (lineCommentEnd < length && source[lineCommentEnd] !== "\n") {
                lineCommentEnd++;
            }
            emitRaw(lineCommentEnd);
            index = lineCommentEnd;
            previousToken = "/";
            continue;
        }
        if (char === '"' || char === "'" || char === "`") {
            emitReplaced(index);
            let quote = char;
            let stringEnd = index + 1;
            while (stringEnd < length) {
                let stringChar = source[stringEnd];
                if (stringChar === "\\" && stringEnd + 1 < length) {
                    stringEnd += 2;
                    continue;
                }
                if (quote === "`" && stringChar === "$" && source[stringEnd + 1] === "{") {
                    emitRaw(stringEnd + 2);
                    let braceDepth = 1;
                    let templateEnd = stringEnd + 2;
                    let exprStart = templateEnd;
                    while (templateEnd < length && braceDepth > 0) {
                        let exprChar = source[templateEnd];
                        if (exprChar === '"' || exprChar === "'" || exprChar === "`") {
                            let nestedQuote = exprChar;
                            for (templateEnd++; templateEnd < length; ) {
                                let nestedChar = source[templateEnd];
                                if (nestedChar === "\\") {
                                    templateEnd += 2;
                                    continue;
                                }
                                if (nestedQuote === "`" && nestedChar === "$" && source[templateEnd + 1] === "{") {
                                    let nestedBraceDepth = 1;
                                    let nestedEnd = templateEnd + 2;
                                    while (nestedEnd < length && nestedBraceDepth > 0) {
                                        let nestedTemplateChar = source[nestedEnd];
                                        if (nestedTemplateChar === "{") {
                                            nestedBraceDepth++;
                                        } else if (nestedTemplateChar === "}") {
                                            nestedBraceDepth--;
                                        }
                                        nestedEnd++;
                                    }
                                    templateEnd = nestedEnd;
                                    continue;
                                }
                                if (nestedChar === nestedQuote) {
                                    templateEnd++;
                                    break;
                                }
                                templateEnd++;
                            }
                            continue;
                        }
                        if (exprChar === "{") {
                            braceDepth++;
                        } else if (exprChar === "}" && (braceDepth--, braceDepth === 0)) {
                            break;
                        }
                        templateEnd++;
                    }
                    let exprEnd = templateEnd;
                    result += rewriteJavaScript(source.slice(exprStart, exprEnd), pattern, replacement);
                    copyIndex = exprEnd;
                    stringEnd = exprEnd;
                    continue;
                }
                if (stringChar === quote) {
                    stringEnd++;
                    break;
                }
                stringEnd++;
            }
            emitRaw(stringEnd);
            index = stringEnd;
            previousToken = ")";
            continue;
        }
        if (char !== " " && char !== "\t" && char !== "\n" && char !== "\r") {
            previousToken = char;
        }
        index++;
    }
    emitReplaced(length);
    return result;
}
// Domain-specific compatibility replacements applied before generic rewriting.
var siteSpecificReplacements = [
    {
        domain: "google.com",
        replacements: [
            {
                regex: /;\w+?\.integrity='sha.+?';/,
                replacement: ";"
            }
        ]
    }
];
// Global identifier replacements used by the injected client bootstrap.
var identifierReplacements = [
    {
        regex: /(?<![-\w])location(?![-\w])/,
        replacement: "___location"
    },
    {
        regex: /\bnavigator.serviceWorker\b/,
        replacement: "navigator.___serviceWorker"
    },
    {
        regex: /\bdocument.requestStorageAccessFor\b/,
        replacement: "document.___requestStorageAccessFor"
    }
];
// Rewrite each URL candidate in a srcset value while preserving descriptors.
function rewriteSrcset(srcset, rewrite) {
    let isWhitespace = (char) => char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f";
    let length = srcset.length;
    let result = "";
    let index = 0;
    while (index < length) {
        let start = index;
        while (index < length && (isWhitespace(srcset[index]) || srcset[index] === ",")) {
            index++;
        }
        result += srcset.slice(start, index);
        if (index >= length) {
            break;
        }
        let tokenStart = index;
        while (index < length && !isWhitespace(srcset[index])) {
            index++;
        }
        let candidate = srcset.slice(tokenStart, index);
        let trailingCommas = "";
        while (candidate.endsWith(",")) {
            candidate = candidate.slice(0, -1);
            trailingCommas += ",";
        }
        result += rewrite(candidate) + trailingCommas;
        if (trailingCommas) {
            continue;
        }
        let commaStart = index;
        while (index < length && srcset[index] !== ",") {
            index++;
        }
        result += srcset.slice(commaStart, index);
    }
    return result;
}
// Rewrite URLs and identifiers in an HTML/JS/CSS body. The body is treated as
// untrusted text; regexes are intentionally conservative.
function rewriteInlineScript({
    body: body,
    proxy_real_host: proxyRealHost,
    proxy_real_protocol: proxyRealProtocol,
    proxy_url_prefix: proxyUrlPrefix,
    token_prefix: tokenPrefix = DEFAULT_TOKEN_PREFIX,
    skipUrlRewrite = false,
    skipIdentifierRewrite = false
}) {
    let result = String(body);
    if (typeof body == "string") {
        body.indexOf("document.URL");
    }
    if (!skipUrlRewrite) {
        siteSpecificReplacements.forEach((siteRule) => {
            if (proxyRealHost.includes(siteRule.domain)) {
                siteRule.replacements.forEach((replacementRule) => {
                    result = result.replace(new RegExp(replacementRule.regex, "g"), replacementRule.replacement);
                });
            }
        });
    }
    if (!skipIdentifierRewrite) {
        identifierReplacements.forEach(({ regex: regex, replacement: replacement }) => {
            result = rewriteJavaScript(result, new RegExp(regex, "g"), replacement);
        });
        result = result.replace(/\bwindow\.location\.href\b/g, "window.___location.href");
    }
    if (!skipUrlRewrite) {
        result = result.replace(/<script[^>]*>/gi, (scriptTag) =>
            scriptTag.replace(/\s+integrity\s*=\s*['\"][^'\"]*['\"]/i, "")
        );
        result = result.replace(/<link[^>]*>/gi, (linkTag) =>
            linkTag.replace(/\s+integrity\s*=\s*['\"][^'\"]*['\"]/i, "")
        );
    }
    if (!isLoginHost(proxyRealHost) && !skipUrlRewrite) {
        let rewriteUrlValue = (url) => {
            let hasTokenPrefix =
                proxyUrlPrefix.endsWith(tokenPrefix) &&
                tokenPrefix.length > 0 &&
                proxyUrlPrefix.length > tokenPrefix.length
                    ? proxyUrlPrefix.slice(0, -tokenPrefix.length)
                    : "";
            url = url.replace(/(url)\s*\(\s*([^)'\"\s]+)\s*\)/g, (match, quote, matchedUrl) => {
                let entityPrefix = "";
                let entityMatch = matchedUrl.match(/^(&quot;|&#34;|&apos;|&#39;)/i);
                let isWrappedEntity =
                    entityMatch &&
                    matchedUrl.length > entityMatch[1].length * 2 &&
                    matchedUrl.slice(-entityMatch[1].length).toLowerCase() === entityMatch[1].toLowerCase();
                if (isWrappedEntity) {
                    entityPrefix = entityMatch[1];
                    matchedUrl = matchedUrl.slice(entityPrefix.length, matchedUrl.length - entityPrefix.length);
                }
                let isAlreadyProxied =
                    matchedUrl.startsWith("data:") ||
                    matchedUrl.startsWith("#") ||
                    matchedUrl.startsWith(proxyUrlPrefix) ||
                    matchedUrl.startsWith(tokenPrefix) ||
                    (hasTokenPrefix && matchedUrl.startsWith(hasTokenPrefix));
                if (isAlreadyProxied) {
                    return match;
                }
                let normalizedUrl = matchedUrl;
                if (normalizedUrl.match(/^https?:\/\//i)) {
                    let protocol = normalizedUrl.split("://")[0];
                    let rest = normalizedUrl.split("://")[1];
                    normalizedUrl = proxyUrlPrefix + protocol + "/" + rest;
                } else if (!normalizedUrl.match(/^[a-z]+:/i)) {
                    if (normalizedUrl.startsWith("//")) {
                        normalizedUrl = proxyUrlPrefix + "https/" + normalizedUrl.slice(2);
                    } else if (normalizedUrl.startsWith("/")) {
                        normalizedUrl = proxyUrlPrefix + proxyRealProtocol + "/" + proxyRealHost + normalizedUrl;
                    } else {
                        normalizedUrl = proxyUrlPrefix + proxyRealProtocol + "/" + proxyRealHost + "/" + normalizedUrl;
                    }
                }
                return quote + "(" + entityPrefix + normalizedUrl + entityPrefix + ")";
            });
            function findClosingQuote(source, startIndex) {
                let cursor = startIndex - 1;
                let depth = 0;
                while (cursor >= 0 && source[cursor] === "\\") {
                    depth++;
                    cursor--;
                }
                if (
                    cursor >= 0 &&
                    source[cursor] === "/" &&
                    (source.substring(cursor + 1, startIndex).match(/\\/g) || []).length % 2 === 0
                ) {
                    let nextIndex = startIndex + 1;
                    let maxDepth = 100;
                    while (
                        nextIndex < source.length &&
                        nextIndex < startIndex + maxDepth &&
                        source[nextIndex] !== "/"
                    ) {
                        nextIndex++;
                    }
                    if (nextIndex < source.length && source[nextIndex] === "/") {
                        let afterIndex = nextIndex + 1;
                        while (afterIndex < source.length && /[gimsuy]/.test(source[afterIndex])) {
                            afterIndex++;
                        }
                        return true;
                    }
                }
                return false;
            }
            function findClosingParen(source, startIndex) {
                let depth = 0;
                for (let cursor = startIndex - 1; cursor >= Math.max(0, startIndex - 16384); cursor--) {
                    let char = source[cursor];
                    if (char === ")") {
                        depth++;
                    } else if (char === "(") {
                        if (depth === 0) {
                            let previous = cursor - 1;
                            while (previous >= 0 && /\s/.test(source[previous])) {
                                previous--;
                            }
                            if (previous >= 2 && source.substring(previous - 2, previous + 1).toLowerCase() === "url") {
                                let inner = source.substring(cursor + 1, startIndex);
                                if (/\bdata:/i.test(inner)) {
                                    return true;
                                }
                            }
                            return false;
                        }
                        depth--;
                    }
                }
                return false;
            }
            let quotedUrlPattern = /([\"'])((https?:\/\/[^'\"\s]+)|(\/[^'\"\s]*))[\"']/gi;
            url = url.replace(quotedUrlPattern, (match, quote, matchedUrl, offset, rest, suffix, trailing) => {
                {
                    let candidateUrl = matchedUrl || rest;
                    if (!candidateUrl) {
                        return match;
                    }
                    let isAlreadyProxied =
                        candidateUrl.startsWith(proxyUrlPrefix) ||
                        candidateUrl.startsWith(tokenPrefix) ||
                        (hasTokenPrefix && candidateUrl.startsWith(hasTokenPrefix));
                    let isInsideScript = findClosingQuote(trailing, suffix) || findClosingParen(trailing, suffix);
                    if (isAlreadyProxied || isInsideScript) {
                        return match;
                    }
                    let rewrittenUrl = candidateUrl;
                    if (candidateUrl.match(/^https?:\/\//i)) {
                        let protocol = candidateUrl.split("://")[0];
                        let restPart = candidateUrl.split("://")[1];
                        rewrittenUrl = proxyUrlPrefix + protocol + "/" + restPart;
                    } else if (!candidateUrl.match(/^[a-z]+:/i)) {
                        if (candidateUrl.startsWith("//")) {
                            rewrittenUrl = proxyUrlPrefix + "https/" + candidateUrl.slice(2);
                        } else if (candidateUrl.startsWith("/")) {
                            rewrittenUrl = proxyUrlPrefix + proxyRealProtocol + "/" + proxyRealHost + candidateUrl;
                        } else {
                            rewrittenUrl =
                                proxyUrlPrefix + proxyRealProtocol + "/" + proxyRealHost + "/" + candidateUrl;
                        }
                    }
                    return quote + rewrittenUrl + quote;
                }
            });
            let rewriteUrl = (targetUrl) => {
                if (!targetUrl) {
                    return targetUrl;
                }
                let isAlreadyProxied =
                    targetUrl.startsWith(proxyUrlPrefix) ||
                    targetUrl.startsWith(tokenPrefix) ||
                    (hasTokenPrefix && targetUrl.startsWith(hasTokenPrefix));
                if (isAlreadyProxied) {
                    return targetUrl;
                }
                if (targetUrl.match(/^https?:\/\//i)) {
                    let protocol = targetUrl.split("://")[0];
                    let rest = targetUrl.split("://")[1];
                    return proxyUrlPrefix + protocol + "/" + rest;
                }
                if (targetUrl.match(/^[a-z]+:/i)) {
                    return targetUrl;
                } else if (targetUrl.startsWith("//")) {
                    return proxyUrlPrefix + "https/" + targetUrl.slice(2);
                } else if (targetUrl.startsWith("/")) {
                    return proxyUrlPrefix + proxyRealProtocol + "/" + proxyRealHost + targetUrl;
                } else {
                    return proxyUrlPrefix + proxyRealProtocol + "/" + proxyRealHost + "/" + targetUrl;
                }
            };
            let srcsetPattern = /\b(srcset|imagesrcset)\s*=\s*(["'])([^"']*)\2/gi;
            url = url.replace(
                srcsetPattern,
                (fullMatch, attrName, quoteChar, srcsetValue) =>
                    attrName + "=" + quoteChar + rewriteSrcset(srcsetValue, rewriteUrl) + quoteChar
            );
            let urlAttrPattern =
                /(?<![\w-])(src|href|action|data-url|poster|cite|manifest)\s*=\s*(["']?)([^"'\s>]+)\2/gi;
            url = url.replace(urlAttrPattern, (urlAttributeMatch, urlAttributeName, urlAttributeQuote, urlValue) => {
                let rewrittenAttrUrl = rewriteUrl(urlValue);
                if (rewrittenAttrUrl === urlValue) {
                    return urlAttributeMatch;
                } else {
                    return urlAttributeName + "=" + urlAttributeQuote + rewrittenAttrUrl + urlAttributeQuote;
                }
            });
            return url;
        };
        if (result.includes("<script") || result.includes("<SCRIPT")) {
            let scriptPattern = /(<script[^>]*>)([\s\S]*?)(<\/script>)/gi;
            let output = "";
            let lastIndex = 0;
            let scriptMatch;
            while ((scriptMatch = scriptPattern.exec(result)) !== null) {
                let beforeScript = result.substring(lastIndex, scriptMatch.index);
                output += rewriteUrlValue(beforeScript);
                let openTag = scriptMatch[1];
                let scriptContent = scriptMatch[2];
                let closeTag = scriptMatch[3];
                output += rewriteUrlValue(openTag) + scriptContent + closeTag;
                lastIndex = scriptMatch.index + scriptMatch[0].length;
            }
            let rest = result.substring(lastIndex);
            output += rewriteUrlValue(rest);
            result = output;
        } else {
            result = rewriteUrlValue(result);
        }
    }
    return result;
}

export { rewriteInlineScript };
