# RCF WAF Gateways

Active network-level gateways and middleware for the **Restricted Correlation Framework (RCF)** to identify and block automated AI scrapers and crawlers on the fly.

## Cloudflare Worker Middleware

The Cloudflare Worker runs at the network Edge to intercept requests before they even hit your origin server.

### Features
1. **User-Agent Filtering**: Instantly blocks requests from known AI scraping bots (such as GPTBot, ClaudeBot, Perplexity, etc.).
2. **Behavioral Rate Limiting**: Monitors requests to files with source code extensions (`.py`, `.ts`, `.js`, etc.). If a client requests more than 10 source files within a 10-second window, they are rate-limited and temporarily blocked.
3. **Custom RCF Branding**: Serves a styled 403 Forbidden / 429 Too Many Requests response under the RCF-PL specification.

### Deployment
1. Navigate to your Cloudflare Dashboard -> **Workers & Pages**.
2. Create a new Worker.
3. Replace the worker code with the contents of `gateway/cloudflare/index.ts` (transpiled to JavaScript).
4. Add routes to match your repository or code host endpoints (e.g., `github.yourdomain.com/*`).

---

## Nginx Lua Module (WAF)

For self-hosted code hosting platforms (like GitLab, Gitea, or custom code servers) running behind Nginx.

### Requirements
* Nginx compiled with the `lua-nginx-module` (e.g. OpenResty)

### Features
* Identical protection signatures as the Cloudflare Worker.
* Uses Nginx shared memory (`lua_shared_dict`) to track client request history globally.

### Deployment
1. Copy `gateway/nginx/rcf_waf.lua` to `/etc/nginx/rcf_waf.lua`.
2. Include the configuration from `gateway/nginx/nginx.conf` in your HTTP or Server blocks:
   ```nginx
   lua_shared_dict rcf_limit 10m;
   
   server {
       ...
       location / {
           access_by_lua_file /etc/nginx/rcf_waf.lua;
           ...
       }
   }
   ```
3. Test your configuration with `nginx -t` and reload Nginx (`systemctl reload nginx`).
