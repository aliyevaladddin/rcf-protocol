/**
 * RCF Gateway — Cloudflare Worker WAF
 * Protects repositories and source assets from AI scraper bots on the Edge.
 */

// List of known AI scraper User-Agents (case-insensitive substrings)
const AI_USER_AGENTS = [
  'gptbot',
  'chatgpt-user',
  'cohere-ai',
  'anthropic-ai',
  'claude-web',
  'claude-user',
  'google-extended',
  'apis-google',
  'perplexitybot',
  'applebot-extended',
  'omgilibot',
  'bytespider',
  'diffbot',
  'imagesiftbot',
  'petalbot',
  'ccbot',
  'yandexbot',
  'facebookexternalhit'
];

// Target source code file extensions
const SOURCE_EXTENSIONS = new Set([
  '.py', '.ts', '.js', '.tsx', '.jsx', '.go', '.rs', 
  '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', 
  '.rb', '.php', '.pyc', '.class'
]);

// Simple in-memory cache for IP rate limiting
// Cloudflare Workers state is preserved per-isolate
const ipRequestHistory = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const MAX_SOURCE_REQUESTS = 10; // max 10 source file requests per 10 seconds

function isAiAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return AI_USER_AGENTS.some(agent => ua.includes(agent));
}

function isSourceFile(urlPath: string): boolean {
  const extIndex = urlPath.lastIndexOf('.');
  if (extIndex === -1) return false;
  const ext = urlPath.substring(extIndex).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

function getRcfBlockedHtml(ip: string, reason: string): string {
  return `<!DOCTYPE html>
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
        <p>Reason: ${reason}</p>
        <div class="meta">
            Client IP: ${ip} | System Status: Active Enforcement | RCF Gate v1.0.0
        </div>
    </div>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // 1. Block known AI User-Agents
    if (isAiAgent(userAgent)) {
      return new Response(
        getRcfBlockedHtml(ip, 'Automated AI harvester signature detected.'),
        {
          status: 403,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    // 2. Behavioral analysis for source code scraping
    if (isSourceFile(url.pathname)) {
      const now = Date.now();
      let history = ipRequestHistory.get(ip) || [];
      
      // Filter out older timestamps outside the rate limit window
      history = history.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
      history.push(now);
      ipRequestHistory.set(ip, history);

      if (history.length > MAX_SOURCE_REQUESTS) {
        return new Response(
          getRcfBlockedHtml(ip, 'Excessive code crawling pattern detected (Rate Limit Exceeded).'),
          {
            status: 429,
            headers: { 'Content-Type': 'text/html' }
          }
        );
      }
    }

    // Pass request through to original origin
    return fetch(request);
  }
};
