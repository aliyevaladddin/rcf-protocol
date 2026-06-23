import { describe, expect, it } from '@jest/globals';
import {
  renderRcfRobotsBlock,
  mergeRobotsBlock,
  ROBOTS_BEGIN,
  ROBOTS_END
} from '../src/core/constants.js';

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
  // 1. renders exact cross sdk contract block
  it('renders the exact cross-SDK contract block', () => {
    expect(renderRcfRobotsBlock()).toBe(EXPECTED_BLOCK);
  });

  // 2. search allowed ai training disallowed
  it('allows search engines but disallows AI training crawlers', () => {
    const block = renderRcfRobotsBlock();
    const allowIdx = block.indexOf('Allow: /');
    const disallowIdx = block.indexOf('Disallow: /');

    expect(block.indexOf('User-agent: Googlebot')).toBeLessThan(allowIdx);
    expect(block.indexOf('User-agent: GPTBot')).toBeGreaterThan(allowIdx);
    expect(block.indexOf('User-agent: GPTBot')).toBeLessThan(disallowIdx);
    expect(block.indexOf('User-agent: ClaudeBot')).toBeLessThan(disallowIdx);
  });

  // 3. merge into empty produces just the block
  it('produces the exact block when merged into empty or null content', () => {
    expect(mergeRobotsBlock(null, renderRcfRobotsBlock())).toBe(EXPECTED_BLOCK);
    expect(mergeRobotsBlock('', renderRcfRobotsBlock())).toBe(EXPECTED_BLOCK);
  });

  // 4. merge is idempotent
  it('is idempotent when re-merging', () => {
    const block = renderRcfRobotsBlock();
    const once = mergeRobotsBlock(null, block);
    const twice = mergeRobotsBlock(once, block);
    expect(twice).toBe(once);
    expect(once.split(ROBOTS_BEGIN).length - 1).toBe(1);
    expect(once.split(ROBOTS_END).length - 1).toBe(1);
  });

  // 5. merge preserves existing lines
  it('preserves existing robots.txt lines outside the RCF block', () => {
    const existing = 'User-agent: *\nDisallow: /tmp\n';
    const merged = mergeRobotsBlock(existing, renderRcfRobotsBlock());
    expect(merged).toContain('Disallow: /tmp');
    expect(merged.split(ROBOTS_BEGIN).length - 1).toBe(1);

    const remerged = mergeRobotsBlock(merged, renderRcfRobotsBlock());
    expect(remerged).toContain('Disallow: /tmp');
    expect(remerged.split(ROBOTS_BEGIN).length - 1).toBe(1);
  });
});
