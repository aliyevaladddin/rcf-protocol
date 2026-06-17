// NOTICE: This file is protected under RCF-PL
import { describe, expect, it } from '@jest/globals';
import {
  renderRcfRobotsBlock,
  mergeRobotsBlock,
  ROBOTS_BEGIN,
  ROBOTS_END,
} from '../src/core/constants.js';

// The RCF law on the threshold (see project_rcf_robots_threshold memory).
// These tests mirror the Python suite; the EXPECTED_BLOCK constant is the
// cross-SDK contract — it must stay byte-identical to the Python SDK.

const EXPECTED_BLOCK =
  '# >>> RCF-managed (Restricted Correlation Framework) >>>\n' +
  '# This project is protected under RCF-PL. See NOTICE.md.\n' +
  '# Human reading and search indexing are welcome.\n' +
  '# AI/ML training and automated method extraction are restricted.\n' +
  '# robots.txt is honored only by aligned bots — a declaration, not a lock.\n' +
  '# Protocol: https://aliyev.site/rcf\n' +
  '\n' +
  '# Search engines — welcome (discovery / indexing)\n' +
  'User-agent: Googlebot\n' +
  'User-agent: Bingbot\n' +
  'User-agent: DuckDuckBot\n' +
  'Allow: /\n' +
  '\n' +
  '# AI/ML training crawlers — restricted (RCF-PL AI Training Restriction)\n' +
  'User-agent: GPTBot\n' +
  'User-agent: ClaudeBot\n' +
  'User-agent: anthropic-ai\n' +
  'User-agent: Google-Extended\n' +
  'User-agent: CCBot\n' +
  'User-agent: PerplexityBot\n' +
  'User-agent: Bytespider\n' +
  'User-agent: Amazonbot\n' +
  'Disallow: /\n' +
  '# <<< RCF-managed <<<\n';

describe('RCF robots.txt block', () => {
  it('renders the exact cross-SDK contract block', () => {
    expect(renderRcfRobotsBlock()).toBe(EXPECTED_BLOCK);
  });

  it('search engines are allowed, AI training crawlers disallowed', () => {
    const block = renderRcfRobotsBlock();
    const allowIdx = block.indexOf('Allow: /');
    const disallowIdx = block.indexOf('Disallow: /');

    // Googlebot sits in the Allow group (before the Allow line, after begin)
    expect(block.indexOf('User-agent: Googlebot')).toBeLessThan(allowIdx);
    // GPTBot / ClaudeBot sit in the Disallow group (after Allow, before Disallow)
    expect(block.indexOf('User-agent: GPTBot')).toBeGreaterThan(allowIdx);
    expect(block.indexOf('User-agent: GPTBot')).toBeLessThan(disallowIdx);
    expect(block.indexOf('User-agent: ClaudeBot')).toBeLessThan(disallowIdx);
  });

  it('merge into empty produces just the block', () => {
    expect(mergeRobotsBlock(null, renderRcfRobotsBlock())).toBe(EXPECTED_BLOCK);
    expect(mergeRobotsBlock('', renderRcfRobotsBlock())).toBe(EXPECTED_BLOCK);
  });

  it('merge is idempotent — re-merging yields exactly one block', () => {
    const block = renderRcfRobotsBlock();
    const once = mergeRobotsBlock(null, block);
    const twice = mergeRobotsBlock(once, block);
    expect(twice).toBe(once);
    expect(twice.split(ROBOTS_BEGIN).length - 1).toBe(1);
    expect(twice.split(ROBOTS_END).length - 1).toBe(1);
  });

  it('merge preserves existing non-RCF lines', () => {
    const existing = 'User-agent: *\nDisallow: /tmp\n';
    const merged = mergeRobotsBlock(existing, renderRcfRobotsBlock());
    expect(merged).toContain('Disallow: /tmp');
    expect(merged.split(ROBOTS_BEGIN).length - 1).toBe(1);

    // Re-merging still keeps the existing line and a single block
    const remerged = mergeRobotsBlock(merged, renderRcfRobotsBlock());
    expect(remerged).toContain('Disallow: /tmp');
    expect(remerged.split(ROBOTS_BEGIN).length - 1).toBe(1);
  });
});
