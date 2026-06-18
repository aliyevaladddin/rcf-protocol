// NOTICE: This file is protected under RCF-PL
import { MarkerDefinition, MarkerType } from './types.js';

// [RCF:PUBLIC]
export const RCF_MARKERS: Record<MarkerType, MarkerDefinition> = {
  PUBLIC: {
    name: '[RCF:PUBLIC]',
    level: 0,
    description: 'Architecture and public concepts. Safe to discuss.',
    permissions: ['read', 'study', 'audit', 'discuss']
  },
  PROTECTED: {
    name: '[RCF:PROTECTED]',
    level: 1,
    description: 'Core methodology. Visible but not replicable.',
    permissions: ['read', 'study', 'audit'],
    restrictions: ['no-replication', 'no-automation', 'no-ml-training']
  },
  RESTRICTED: {
    name: '[RCF:RESTRICTED]',
    level: 2,
    description: 'Highly sensitive implementation. Minimal rights.',
    permissions: ['read'],
    restrictions: ['no-replication', 'no-automation', 'no-ml-training', 'no-modification']
  },
  NOTICE: {
    name: '[RCF:NOTICE]',
    level: 'meta',
    description: 'Triggers requirement for adjacent legal notice.',
    action: 'require-notice'
  }
};

export const MARKER_REGEX = /\[RCF:(PUBLIC|PROTECTED|RESTRICTED|NOTICE)\]/g;

// ─── robots.txt — the RCF law on the project's threshold ──────────────────────
//
// RCF declares itself in the entry ritual every crawler/agent performs
// (robots.txt is read first, before any code). This is the *announcing* half:
// only aligned bots honor robots.txt — a declaration, not a lock. A thief who
// strips it is caught by the other half (audit correlation).
//
// These lists and the block text are a shared contract: they MUST stay
// byte-identical to the Python SDK (rcf_cli/cli.py) so a project is described
// the same way whichever SDK generated its robots.txt.

export const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'DuckDuckBot'];

export const AI_TRAINING_BOTS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'CCBot',
  'PerplexityBot',
  'Bytespider',
  'Amazonbot',
];

export const ROBOTS_BEGIN = '# >>> RCF-managed (Restricted Correlation Framework) >>>';
export const ROBOTS_END = '# <<< RCF-managed <<<';

/** The RCF-managed robots.txt block. Byte-identical to the Python SDK. */
export function renderRcfRobotsBlock(): string {
  const lines: string[] = [
    ROBOTS_BEGIN,
    '# This project is protected under RCF-PL. See NOTICE.md.',
    '# Human reading and search indexing are welcome.',
    '# AI/ML training and automated method extraction are restricted.',
    '# robots.txt is honored only by aligned bots — a declaration, not a lock.',
    '# Protocol: https://aliyev.site/rcf',
    '',
    '# Search engines — welcome (discovery / indexing)',
    ...SEARCH_BOTS.map((bot) => `User-agent: ${bot}`),
    'Allow: /',
    '',
    '# AI/ML training crawlers — restricted (RCF-PL AI Training Restriction)',
    ...AI_TRAINING_BOTS.map((bot) => `User-agent: ${bot}`),
    'Disallow: /',
    ROBOTS_END,
  ];
  return lines.join('\n') + '\n';
}

/**
 * Idempotently merge the RCF block into an existing robots.txt.
 *  - replace a previous RCF-managed block in place (never duplicate),
 *  - otherwise append, preserving existing content,
 *  - if there is no existing content, the block is the whole file.
 */
export function mergeRobotsBlock(existing: string | null | undefined, block: string): string {
  const normBlock = block.replace(/\n+$/, '') + '\n';
  if (!existing || !existing.trim()) {
    return normBlock;
  }

  const start = existing.indexOf(ROBOTS_BEGIN);
  const endIdx = existing.indexOf(ROBOTS_END);
  if (start !== -1 && endIdx !== -1 && endIdx > start) {
    const endFull = endIdx + ROBOTS_END.length;
    const before = existing.slice(0, start);
    let after = existing.slice(endFull);
    if (after.startsWith('\n')) after = after.slice(1);
    const tail = after.trim() ? '\n' + after : '\n';
    return before + normBlock.replace(/\n+$/, '') + tail;
  }

  const sep = existing.endsWith('\n') ? '' : '\n';
  return existing + sep + '\n' + normBlock;
}
