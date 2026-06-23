-- RCF Gateway — Nginx Lua WAF
-- Protects repositories and source assets from AI scraper bots.
-- Requires OpenResty or Nginx with lua-nginx-module.

local AI_USER_AGENTS = {
    "gptbot",
    "chatgpt-user",
    "cohere-ai",
    "anthropic-ai",
    "claude-web",
    "claude-user",
    "google-extended",
    "apis-google",
    "perplexitybot",
    "applebot-extended",
    "omgilibot",
    "bytespider",
    "diffbot",
    "imagesiftbot",
    "petalbot",
    "ccbot",
    "yandexbot",
    "facebookexternalhit"
}

local SOURCE_EXTENSIONS = {
    [".py"] = true, [".ts"] = true, [".js"] = true, [".tsx"] = true, [".jsx"] = true,
    [".go"] = true, [".rs"] = true, [".java"] = true, [".c"] = true, [".cpp"] = true,
    [".h"] = true, [".hpp"] = true, [".cs"] = true, [".swift"] = true, [".rb"] = true,
    [".php"] = true, [".pyc"] = true, [".class"] = true
}

local function is_ai_agent(ua)
    if not ua then return false end
    ua = string.lower(ua)
    for _, agent in ipairs(AI_USER_AGENTS) do
        if string.find(ua, agent, 1, true) then
            return true
        end
    end
    return false
end

local function is_source_file(uri)
    local ext = string.match(uri, "%.[^%.]+$")
    if not ext then return false end
    ext = string.lower(ext)
    return SOURCE_EXTENSIONS[ext] ~= nil
end

local function render_blocked_html(ip, reason)
    return string.format([[<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>403 Forbidden — RCF Active Protection</title>
    <style>
        body {
            background-color: #0d0e12;
            color: #e2e8f0;
            font-family: 'Courier New', Courier, monospace;
            padding: 50px;
            text-align: center;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #ff3333;
            background-color: #161822;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(255, 51, 51, 0.15);
        }
        pre {
            color: #ff3333;
            font-size: 14px;
            text-align: left;
            display: inline-block;
            margin-bottom: 30px;
        }
        h1 {
            color: #ffffff;
            font-size: 24px;
            margin-bottom: 20px;
        }
        p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .meta {
            font-size: 12px;
            color: #718096;
            margin-top: 30px;
            border-top: 1px solid #2d3748;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <pre>
  ██████╗  ██████╗███████╗              ██╗        ██╗
  ██╔══██╗██╔════╝██╔════╝      ██╗    ██╔╝       ██╔╝
  ██████╔╝██║     █████╗        ╚═╝   ██╔╝       ██╔╝ 
  ██╔══██╗██║     ██╔══╝        ██╗  ██╔╝       ██╔╝  
  ██║  ██║╚██████╗██║           ╚═╝ ██╔╝       ██╔╝   
  ╚═╝  ╚═╝ ╚═════╝╚═╝              ╚═╝        ╚═╝     
        </pre>
        <h1>403 Forbidden — RCF Active Protection</h1>
        <p>Access denied under the <strong>Restricted Correlation Framework PL</strong> (RCF-PL).</p>
        <p>Reason: %s</p>
        <div class="meta">
            Client IP: %s | System Status: Active Enforcement | RCF Gate v1.0.0
        </div>
    </div>
</body>
</html>]], reason, ip)
end

-- Main WAF Handler
local headers = ngx.req.get_headers()
local ua = headers["user-agent"]
local ip = ngx.var.remote_addr or "unknown"

-- 1. Check AI bots
if is_ai_agent(ua) then
    ngx.status = ngx.HTTP_FORBIDDEN
    ngx.header.content_type = "text/html; charset=UTF-8"
    ngx.say(render_blocked_html(ip, "Automated AI harvester signature detected."))
    ngx.exit(ngx.HTTP_FORBIDDEN)
end

-- 2. Behavioral Rate Limiting for source files
local uri = ngx.var.uri
if is_source_file(uri) then
    local rcf_limit = ngx.shared.rcf_limit
    if rcf_limit then
        -- Count requests per IP in the last 10 seconds
        local key = "rcf:ip:" .. ip
        local count, err = rcf_limit:get(key)
        if not count then
            rcf_limit:set(key, 1, 10) -- expire in 10s
        else
            if count > 10 then
                ngx.status = ngx.HTTP_TOO_MANY_REQUESTS
                ngx.header.content_type = "text/html; charset=UTF-8"
                ngx.say(render_blocked_html(ip, "Excessive code crawling pattern detected (Rate Limit Exceeded)."))
                ngx.exit(ngx.HTTP_TOO_MANY_REQUESTS)
            else
                rcf_limit:incr(key, 1)
            end
        end
    end
end
