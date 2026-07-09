#!/usr/bin/env bash
#
# docs_impact_guard.sh - the one canonical "did you forget the docs?" guard.
#
# This single script is the heart of the system. Every enforcement layer calls
# it, so no two layers can ever disagree about what counts as a "hot" code path
# or what counts as "docs were updated". Copy it verbatim into a new project and
# adjust ONLY the two CONFIG values below (DOC_PATHS_RE and TEST_RE) plus the
# trigger file (scripts/docs_hot_paths.txt). The mode machinery is
# stack-independent.
#
# It runs in five modes, all sharing the same classification logic:
#
#   (no args)            Stop-hook mode (for AI agent "session ended" hooks).
#                        Compares working tree + staged + untracked vs HEAD.
#                        Exit 2 (blocks the agent's stop; stderr is fed back into
#                        the conversation) the FIRST time a hot path changed with
#                        no doc change; exits 0 on the next stop so it reminds
#                        once and never loops.
#   --worktree           Manual local check. Compares working tree + staged +
#                        untracked vs HEAD. Exit 1 if a hot path changed with no
#                        doc change. No reminder marker, no bypass file.
#   --staged             pre-commit advisory. Looks only at staged files. Always
#                        exits 0; prints a reminder to stderr if it would block.
#   --commit-msg <FILE>  commit-msg gate (the real git guarantee). Blocks the
#                        commit (exit 1) when hot paths are staged with no doc
#                        change AND the message lacks a `Docs-Impact: none -
#                        <reason>` trailer.
#   --ci                 CI mode. Looks at the PR diff range (BASE_REF..HEAD,
#                        default origin/main). Exit 1 if hot paths changed with no
#                        doc change and DOCS_IMPACT_DECLARED is not set (the
#                        workflow sets it from the PR body). Pure check, no
#                        marker, no bypass file.
#
# See your entry doc's "Docs Impact (Definition of Done)" section for the
# human-facing contract.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 0

# ============================ CONFIG (edit me) ===============================
# The single shared trigger list (code paths that almost always need docs).
HOT_PATHS_FILE="scripts/docs_hot_paths.txt"

# Any change matching this regex counts as "docs were updated". Add/remove the
# doc roots your project actually uses.
DOC_PATHS_RE='^(AGENTS\.md|README\.md|CONTRIBUTING\.md|docs/|specs/|scripts/docs_hot_paths\.txt|scripts/docs_impact_guard\.sh|scripts/docs_consistency_check\.sh)'

# Test files that should NOT, on their own, count as a hot code change. Widen
# this to match your stack's test conventions (e.g. tests/, spec/, *.spec.ts).
TEST_RE='(_test\.|\.test\.|\.spec\.|/tests?/|/spec/|_test/)'

# Accepted explicit no-docs declaration. Require a reason after the hyphen so
# bypasses stay grep-able and auditable.
NO_DOCS_REASON_RE='^docs[ -]?impact:\s*none\s*-\s*\S'
# ============================================================================

mode="stop"
commit_msg_file=""
case "${1:-}" in
  --worktree) mode="worktree" ;;
  --staged) mode="staged" ;;
  --commit-msg) mode="commit-msg"; commit_msg_file="${2:-}" ;;
  --ci) mode="ci" ;;
  "") mode="stop" ;;
  *) echo "docs_impact_guard: unknown mode '$1'" >&2; exit 0 ;;
esac

# --- collect the changed file list for this mode -----------------------------
changed=""
case "$mode" in
  stop|worktree)
    changed="$(
      { git diff --name-only HEAD 2>/dev/null
        git diff --name-only --cached 2>/dev/null
        git ls-files --others --exclude-standard 2>/dev/null
      } | sort -u
    )"
    ;;
  staged|commit-msg)
    changed="$(git diff --name-only --cached 2>/dev/null | sort -u)"
    ;;
  ci)
    base="${BASE_REF:-origin/main}"
    range_base="$(git merge-base "$base" HEAD 2>/dev/null || echo "$base")"
    changed="$(git diff --name-only "$range_base"...HEAD 2>/dev/null | sort -u)"
    ;;
esac

# Nothing changed: nothing to guard.
[ -z "$changed" ] && exit 0

# --- classify ----------------------------------------------------------------
# Build the hot-path regex from the shared trigger file.
hot_re=""
if [ -f "$HOT_PATHS_FILE" ]; then
  while IFS= read -r line; do
    case "$line" in ''|\#*) continue ;; esac
    if [ -z "$hot_re" ]; then hot_re="$line"; else hot_re="$hot_re|$line"; fi
  done < "$HOT_PATHS_FILE"
fi
[ -z "$hot_re" ] && exit 0   # no triggers configured: never block

# Hot files = match a trigger AND are not test files.
hot="$(printf '%s\n' "$changed" | grep -E "$hot_re" 2>/dev/null | grep -Ev "$TEST_RE" 2>/dev/null)"
docs="$(printf '%s\n' "$changed" | grep -E "$DOC_PATHS_RE" 2>/dev/null)"

# No hot paths, or docs already updated: all good.
[ -z "$hot" ] && exit 0
[ -n "$docs" ] && exit 0

hot_list="$(printf '%s' "$hot" | tr '\n' ' ' | sed 's/  */ /g; s/ $//')"

read -r -d '' REMINDER <<EOF
Docs Impact check: you changed hot paths with no documentation update:
  $hot_list

Evaluate the Docs Impact table in your entry doc and either:
  - update the mapped doc(s) in THIS change (AGENTS.md / README.md /
    CONTRIBUTING.md / docs/ / specs/ / docs-system scripts), or
  - explicitly declare "Docs impact: none - <reason>" in your final summary.
EOF

# --- act on the classification per mode --------------------------------------
case "$mode" in
  stop)
    # Block once: key the marker to the current hot set so we don't loop.
    # Resolve via git so it works in worktrees (where .git is a file, not a dir).
    marker="$(git rev-parse --git-path docs_impact_reminded 2>/dev/null || echo .git/docs_impact_reminded)"
    state_hash="$(printf '%s' "$hot" | git hash-object --stdin 2>/dev/null || printf '%s' "$hot" | cksum | awk '{print $1}')"
    if [ -f "$marker" ] && [ "$(cat "$marker" 2>/dev/null)" = "$state_hash" ]; then
      exit 0   # already reminded for this exact set of changes
    fi
    printf '%s' "$state_hash" > "$marker" 2>/dev/null || true
    echo "$REMINDER" >&2
    exit 2
    ;;
  worktree)
    echo "$REMINDER" >&2
    echo "" >&2
    echo "Manual check failed; update docs or document the no-docs reason before publishing." >&2
    exit 1
    ;;
  staged)
    echo "$REMINDER" >&2
    echo "(advisory only - commit allowed; the commit-msg gate enforces this.)" >&2
    exit 0
    ;;
  commit-msg)
    if [ -n "$commit_msg_file" ] && grep -qiE "$NO_DOCS_REASON_RE" "$commit_msg_file" 2>/dev/null; then
      exit 0   # honest declaration present in the commit message: allow
    fi
    echo "$REMINDER" >&2
    echo "" >&2
    echo "To proceed without doc changes, add a trailer to your commit message:" >&2
    echo "  Docs-Impact: none - <reason>" >&2
    echo "(or stage the relevant doc, or bypass once with: git commit --no-verify)" >&2
    exit 1
    ;;
  ci)
    if [ -n "${DOCS_IMPACT_DECLARED:-}" ]; then
      exit 0   # PR body contained "Docs impact: none"
    fi
    echo "$REMINDER" >&2
    echo "" >&2
    echo "Add the changed doc(s) to this PR, or put a line in the PR body:" >&2
    echo "  Docs impact: none - <reason>" >&2
    exit 1
    ;;
esac
