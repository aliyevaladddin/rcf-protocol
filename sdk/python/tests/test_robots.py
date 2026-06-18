# NOTICE: This file is protected under RCF-PL
"""Tests for the RCF robots.txt block — the law on the project's threshold.

Mirrors the TypeScript suite (tests/robots.test.ts). EXPECTED_BLOCK is the
cross-SDK contract: it MUST stay byte-identical to the TS SDK so a project is
described the same way whichever SDK generated its robots.txt.
"""

from rcf_cli.cli import (
    _render_rcf_robots_block,
    _merge_robots_block,
    ROBOTS_BEGIN,
    ROBOTS_END,
)

EXPECTED_BLOCK = (
    "# >>> RCF-managed (Restricted Correlation Framework) >>>\n"
    "# This project is protected under RCF-PL. See NOTICE.md.\n"
    "# Human reading and search indexing are welcome.\n"
    "# AI/ML training and automated method extraction are restricted.\n"
    "# robots.txt is honored only by aligned bots — a declaration, not a lock.\n"
    "# Protocol: https://aliyev.site/rcf\n"
    "\n"
    "# Search engines — welcome (discovery / indexing)\n"
    "User-agent: Googlebot\n"
    "User-agent: Bingbot\n"
    "User-agent: DuckDuckBot\n"
    "Allow: /\n"
    "\n"
    "# AI/ML training crawlers — restricted (RCF-PL AI Training Restriction)\n"
    "User-agent: GPTBot\n"
    "User-agent: ClaudeBot\n"
    "User-agent: anthropic-ai\n"
    "User-agent: Google-Extended\n"
    "User-agent: CCBot\n"
    "User-agent: PerplexityBot\n"
    "User-agent: Bytespider\n"
    "User-agent: Amazonbot\n"
    "Disallow: /\n"
    "# <<< RCF-managed <<<\n"
)


def test_renders_exact_cross_sdk_contract_block():
    assert _render_rcf_robots_block() == EXPECTED_BLOCK


def test_search_allowed_ai_training_disallowed():
    block = _render_rcf_robots_block()
    allow_idx = block.index("Allow: /")
    disallow_idx = block.index("Disallow: /")

    # Googlebot sits in the Allow group
    assert block.index("User-agent: Googlebot") < allow_idx
    # GPTBot / ClaudeBot sit in the Disallow group
    assert allow_idx < block.index("User-agent: GPTBot") < disallow_idx
    assert block.index("User-agent: ClaudeBot") < disallow_idx


def test_merge_into_empty_produces_just_the_block():
    assert _merge_robots_block(None, _render_rcf_robots_block()) == EXPECTED_BLOCK
    assert _merge_robots_block("", _render_rcf_robots_block()) == EXPECTED_BLOCK


def test_merge_is_idempotent():
    block = _render_rcf_robots_block()
    once = _merge_robots_block(None, block)
    twice = _merge_robots_block(once, block)
    assert twice == once
    assert once.count(ROBOTS_BEGIN) == 1
    assert once.count(ROBOTS_END) == 1


def test_merge_preserves_existing_lines():
    existing = "User-agent: *\nDisallow: /tmp\n"
    merged = _merge_robots_block(existing, _render_rcf_robots_block())
    assert "Disallow: /tmp" in merged
    assert merged.count(ROBOTS_BEGIN) == 1

    remerged = _merge_robots_block(merged, _render_rcf_robots_block())
    assert "Disallow: /tmp" in remerged
    assert remerged.count(ROBOTS_BEGIN) == 1
