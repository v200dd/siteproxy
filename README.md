# SiteProxy

SiteProxy 是一个基于 [Hono](https://hono.dev/) 的在线网页代理。访问者打开形如 `{proxy_url}{token_prefix}{protocol}/{host}/{path}` 的地址后，代理会在服务端取回目标网站的内容，改写其中的链接并注入浏览器端脚本，让页面继续留在代理域名下。项目同时支持 **Cloudflare Workers** 和 **Node.js 自托管** 两种运行方式。

本仓库基于 [netptop/siteproxy](https://github.com/netptop/siteproxy) 2.7.11 重构：

- 服务端按职责拆分到 `src/` 下的多个模块；
- 原混淆包中的浏览器端脚本 `client.js`、`service-worker.js` 已还原为可读源码并纳入版本管理；
- 使用 esbuild 生成 Node 与 Workers 产物；
- 仅保留 Node 与 Workers 部署方式，不再包含 Cloudflare Pages、Docker 和 RSA/AES 登录加密逻辑。

> [!CAUTION]
> 请勿将本项目用于任何违法用途。通过本项目访问第三方网站时，请遵守目标网站的服务条款和当地法律法规。

## 功能概览

- **密码式访问控制**：`token_prefix` 同时充当访问路径和密码，不知道完整前缀就无法使用代理。
- **完整页面代理**：服务端改写重定向地址和 HTML/CSS 中的 URL，并注入客户端脚本处理 JavaScript 运行时动态生成的 URL。
- **Service Worker 接管**：浏览器端注册 `siteproxy_service_worker.js`，负责动态请求转发、请求体解码和超大响应头还原。
- **Cookie 隔离**：把上游网站的 `Set-Cookie` 作用域限制在代理前缀下，并用内部 Cookie 记录当前目标站点。
- **压缩与编码处理**：支持 gzip/br 的解压与重压；Node 使用 zlib，Workers 使用 CompressionStream。
- **大响应头支持**：超过平台限制的响应头会被编码进响应体，再由 Service Worker 解包。
- **内置首页**：访问 `{proxy_url}{token_prefix}` 可以打开带明暗主题和常用站点链接的静态导航页。
- **兼容规则**：内置针对 Telegram Web 登录页及个别站点的特殊处理。

## 部署

预构建产物发布在 [GitHub Releases](https://github.com/zzzxxxxxxxxxx/siteproxy/releases)：

- [worker.js](https://github.com/zzzxxxxxxxxxx/siteproxy/releases/latest/download/worker.js)：Cloudflare Workers 入口
- [bundle.mjs](https://github.com/zzzxxxxxxxxxx/siteproxy/releases/latest/download/bundle.mjs)：Node.js 入口

这两个文件不纳入 Git 仓库，可以选择下载 Release 产物或从源码构建。

<details>
<summary><code><strong>「 Cloudflare Workers 部署 」</strong></code></summary>

**方式一：Dashboard 直接粘贴**

1. 获取 `worker.js`：
   - 从 Release 下载：[下载 worker.js](https://github.com/zzzxxxxxxxxxx/siteproxy/releases/latest/download/worker.js)
   - 或者本地构建：

```bash
npm ci
npm run build
```

2. 在 Cloudflare Dashboard 打开 **Workers & Pages**，新建一个 Worker。
3. 进入编辑器的代码页，把 `worker.js` 内容完整粘贴进去并部署。
4. 在 Worker 的 **Settings → Variables and Secrets** 添加 `token_prefix`，例如 `/your-password/`，首尾都要有 `/`。Workers 会从当前请求域名自动推导 `proxy_url`。
5. 在 **Settings → Runtime** 的 Compatibility flags 中加上 `nodejs_compat`。`worker.js` 依赖 Node 兼容层，不加会启动失败。
6. 保存并重新部署，然后访问 `{proxy_url}{token_prefix}`。

如果不想让 `token_prefix` 以明文显示，可以在 Variables and Secrets 中把它添加为 Secret，不会影响代码读取。
缺少 `token_prefix` 时所有请求会返回 `503`，不会退回到公开默认密码。

**方式二：连接 GitHub**

1. Fork 本仓库。
2. 在 Dashboard 打开 **Workers & Pages**，新建 Worker，选择 **Connect to Git**，授权并选择 fork 后的仓库和分支。
3. 在 Worker 的 **Settings → Variables and Secrets** 修改 `token_prefix`。无需配置 `proxy_url`。
4. 保存并部署。

仓库不提交 `worker.js` 和 `bundle.mjs`。Cloudflare Workers 构建会按照 `wrangler.jsonc` 执行 `npm run build`，生成 `main` 指定的 `worker.js`；构建监视目录为 `./src`。

Cloudflare Workers 始终从请求域名推导 `proxy_url`，不会读取 Worker 环境中的 `proxy_url`。

Cloudflare 的出口 IP 可能被部分站点限制，遇到访问异常时可改用 VPS 部署；免费套餐对请求和响应体大小也有限制。

</details>

<details>
<summary><code><strong>「 Node.js / VPS 部署 」</strong></code></summary>

**方式一：Release 产物**

1. 安装 Node.js 22+。
2. 从 Release 下载 [下载 bundle.mjs](https://github.com/zzzxxxxxxxxxx/siteproxy/releases/latest/download/bundle.mjs)。
3. 新建 `config.json`，例如：

```json
{
  "proxy_url": "https://proxy.example.com",
  "token_prefix": "/your-password/",
  "local_listen_port": 5006
}
```

4. 在 `bundle.mjs` 和 `config.json` 所在目录启动：

```bash
node bundle.mjs
```

**方式二：源码构建**

1. 克隆仓库并安装 Node.js 22+。
2. 修改 `config.json`，把 `proxy_url` 设为最终的 `https://` 地址。
3. 安装依赖并生成 Node 产物：

```bash
npm ci
npm run build
```

4. 启动服务：

```bash
npm start
```

也可以使用 PM2：

```bash
npm install -g pm2
pm2 start bundle.mjs --name siteproxy
pm2 save
```

**使用 Nginx 终止 TLS**

把 Nginx 反向代理到本地端口：

```nginx
server {
    listen 443 ssl;
    server_name proxy.example.com;

    # ssl_certificate / ssl_certificate_key ...

    location / {
        proxy_pass http://127.0.0.1:5006;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

访问 `https://proxy.example.com/your-password/`。

Node 进程本身只提供 HTTP，TLS 由 Nginx、Caddy 等反向代理负责。

</details>

## 工作原理

```
浏览器
  │  https://proxy.example.com/your-password/https/example.com/path
  ▼
Hono 应用（Node / Cloudflare Worker）
  │  1. 返回浏览器端脚本、首页或 Service Worker
  │  2. 删除上游 CSP 与报告类响应头
  │  3. 把请求路径规范化为目标 URL
  │  4. 清洗请求头与 Cookie，向目标站点发起请求
  │  5. 改写响应：Location、HTML/JS/CSS、Set-Cookie
  ▼
目标网站
```

### 请求处理流程

1. **返回客户端脚本**：任何以 `siteproxy-response-injected.js` 结尾的请求都直接返回内嵌的客户端脚本，不再当作目标 URL 处理。
2. **清理 CSP**：代理会改写页面并注入脚本，因此响应链路上会删除 `Content-Security-Policy` 及 `Content-Security-Policy-Report-Only`。
3. **首页与 Service Worker**：token 根路径返回内置首页；`{token_prefix}siteproxy_service_worker.js` 返回带有当前配置前缀的 Service Worker 脚本。
4. **规范化目标地址**：`src/proxy/normalize.mjs` 把 token 路径、Referer、代理 Cookie 等不同来源的路径统一成 `{token_prefix}{protocol}/{host}/...`。
5. **转发请求**：`src/proxy/request.mjs` 解析目标主机，过滤 `proxy_real_*` 等内部 Cookie 和代理特征请求头，重写 `Referer`/`Origin`，然后用 `redirect: "manual"` 请求上游。CORS 预检请求（`OPTIONS`）会被直接转发。
6. **改写响应**：`src/proxy/response.mjs` 改写 `Location`，对状态码小于 500 的 HTML/JS/CSS 解压、改写、注入脚本并重新压缩，最后处理响应头与 Cookie。

### 响应改写要点

- **HTML**：改写 `src`、`href`、`action`、`poster`、`srcset`、`imagesrcset`、内联样式里的 `url(...)` 等 URL，移除 `<script>`/`<link>` 的 SRI `integrity` 属性，并注入引导脚本。
- **JavaScript**：用一个轻量词法扫描器替换 `location` 标识符、`window.location` 赋值等，跳过字符串、注释和正则字面量，并递归处理模板字符串中的表达式；同时插入 location guard，避免脚本在注入前读取代理地址。
- **CSS**：只改写 `url(...)`，不替换标识符。
- **字符集**：根据响应头或 `<meta charset>` 解码，统一转成 UTF-8 并同步更新响应头。
- **重定向**：`301/302/303/307/308` 的 `Location` 会被改写回代理前缀。
- **Cookie**：上游 `Set-Cookie` 的 `Domain` 改为代理域名、`Path` 改为对应的 token 路径，非删除类 Cookie 统一追加 `Max-Age=1800`；响应同时下发 `proxy_real_protocol` 和 `proxy_real_host` 两个内部 Cookie，作为后续请求的目标站点兜底信息。

### 实现细节

- **超大响应头**：单个响应头超过 4096 字符时，如果请求带有 `siteproxy-sw: 1`（表示浏览器端已注册 Service Worker），该响应头会从响应头中移除，编码进响应体；否则直接丢弃。编码格式为魔数 `\0\0SITEPROXYHDR\0`、4 字节大端 JSON 长度、JSON 头、原始 body，并带上 `x-siteproxy-body-headers: 1`，由 Service Worker 解包。SSE 流式响应的超限头会被直接丢弃。
- **Cookie 超限**：转发前如果请求 Cookie 超过 4000 字节，服务端返回 `431`，并最多下发 2 条过期指令让浏览器清理超限 Cookie。
- **请求头清洗**：删除 `siteproxy*`、`cf-*`、`x-forwarded*`、`forwarded`、`via`、`x-real-ip` 等代理或转发特征头，再设置目标的 `Host`，并固定使用 `Accept-Encoding: gzip`。
- **Service Worker**：接管 token 作用域下的请求，处理动态请求的目标主机判定、请求体中的代理 URL 解码、超大响应头还原，并对 `static.cloudflareinsights.com` 返回空脚本。
- **特殊站点**：`telegram.org` 作为登录站点单独处理；`telegram.org/service_worker.js`、`elcomercio.pe`、`exchangebank.com` 会跳过普通代理路径。相关列表位于 `src/config.mjs`。

## 目录结构

```text
.
├── .github/workflows/
│   ├── ci.yml                 # 测试、构建和 Wrangler dry-run
│   └── release.yml            # tag 驱动的自动 Release
├── src/
│   ├── index.mjs              # Hono 应用装配、中间件顺序、Node 启动、Worker 导出
│   ├── config.mjs             # 配置加载、兼容站点列表、运行环境判断
│   ├── routes/
│   │   ├── home.mjs           # token 根路径的首页
│   │   └── service-worker.mjs # 带配置前缀的 Service Worker
│   ├── proxy/
│   │   ├── normalize.mjs      # 目标 URL 规范化
│   │   ├── request.mjs        # 上游请求、请求头/Cookie 清洗、431 处理
│   │   ├── response.mjs       # 响应解压/压缩、注入、超大响应头打包
│   │   └── cookies.mjs        # Cookie 与请求/响应头工具
│   ├── rewrite/index.mjs      # HTML/JS/CSS 的 URL 与标识符改写
│   ├── embedded/index.mjs     # 构建期文本资产入口
│   └── assets/
│       ├── homepage.html      # 内置首页
│       ├── client.js          # 注入到目标页面的浏览器端脚本
│       └── service-worker.js  # Service Worker 源码
├── scripts/
│   └── build.mjs              # esbuild 打包脚本
├── test/                      # 配置、路由、解析和改写测试
├── config.json                # Node 运行配置
├── wrangler.jsonc              # Cloudflare Workers 配置
├── package-lock.json          # npm 依赖锁文件
├── bundle.mjs                 # 构建产物：Node 入口（已忽略）
├── worker.js                  # 构建产物：Workers 入口（已忽略）
└── package.json
```

`bundle.mjs` 和 `worker.js` 由 `npm run build` 生成并写入 `.gitignore`，不纳入版本控制。Node 部署需要先构建再启动；Cloudflare Workers 构建会自动执行项目构建命令。不要手工编辑这两个产物。

## 开发

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run build` | 用 esbuild 生成 Node 产物 `bundle.mjs` 与 Workers 产物 `worker.js` |
| `npm test` | 构建产物并运行 Node 内置测试套件 |
| `npm run check` | 依次运行测试、构建和产物语法检查 |
| `npm start` | 运行已构建的 Node 产物，首次运行前需要先执行 `npm run build` |

### 构建说明

`scripts/build.mjs` 使用一个 esbuild 文本资产插件，把 `src/assets` 下的 `.js` 和 `.html` 作为字符串嵌入 bundle，因此这些文件在源码树中仍然是可读、可审查的普通文件。两个产物都是 ESM：

- Node 产物平台为 `node`；
- Worker 产物平台为 `neutral`，并把 `@hono/node-server`、`fs`、`http`、`zlib` 等 Node 内置模块标记为 external。

仓库包含 GitHub Actions CI，拉取请求和 `master` 更新会运行测试、构建和 Wrangler dry-run。推送任意 tag 时，Release 工作流会自动构建并创建 GitHub Release，上传 `worker.js` 和 `bundle.mjs`。

## 已知限制与注意事项

- **只有 token 保护**：没有账号体系，token 泄露等于代理被公开使用。
- **CSP 被移除**：为了注入客户端脚本，上游的 CSP 和报告类响应头不会保留，目标页面的内容安全策略不再生效。
- **只改写可识别的响应**：仅对状态码小于 500 的 HTML/JavaScript/CSS 做内容改写，其他类型原样转发。
- **内存占用**：需要改写的响应会整体读入内存，超大页面或大文件可能带来内存压力，也可能触及 Cloudflare 的响应体限制。
- **Cookie 有效期**：被改写的非删除类 Cookie 会统一追加 `Max-Age=1800`（约 30 分钟）。
- **站点兼容性**：依赖严格 CSP、复杂登录流程或特殊协议的网站可能无法正常使用；YouTube 等站点可能受反爬策略影响。
- **登录页风险**：代理页面可能被用于钓鱼，客户端会插入顶部警告条；请不要在通过代理打开的页面中输入敏感信息。
- **Service Worker 依赖 HTTPS**：非 localhost 的纯 HTTP 部署无法注册 Service Worker，动态 URL 处理和大响应头还原会失效。

## 上游与许可

- 上游项目：<https://github.com/netptop/siteproxy>
- `src/assets/client.js` 与 `src/assets/service-worker.js` 的文件头注明：它们由 siteproxy 2.7.11 的混淆包还原而来，是等价的逆向实现，并非原始源码。
- 本项目以 MIT License 发布，详见 [LICENSE](LICENSE)。

## 致谢

- 上游作者 netptop 及社区贡献者。
- 默认主页设计：Telegram 网友 SenZyo（来自上游 README）。
