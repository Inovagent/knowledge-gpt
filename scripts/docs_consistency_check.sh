#!/usr/bin/env bash
#
# docs_consistency_check.sh - mechanical "do the docs describe things that
# actually exist?" assertions. Everything checked here is in-repo, so these run
# the same in CI and in the periodic audit skill.
#
# HARD checks fail the run (exit 1). SOFT checks only warn (advisory drift that
# a human resolves), so the gate stays honest without alert fatigue.
#
# This file is the MOST project-specific part of the system. The generic checks
# below (shim integrity, doc-named-path existence) port as-is. The
# "PROJECT-SPECIFIC REGISTRY CHECKS" section is where you wire in parity between
# your machine-readable registries (route tables, serverless function configs,
# env modules, package manifests) and your docs. Examples are provided per stack
# in references/adapting-per-stack.md.

set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" || exit 1

fail=0
hard() { echo "FAIL: $1"; fail=1; }
warn() { echo "WARN: $1"; }
ok()   { echo "ok:   $1"; }

# ===================== GENERIC CHECKS (port as-is) ===========================

# 1) Tool shim integrity: if CLAUDE.md exists it must be the @AGENTS.md shim,
#    not a divergent second instruction file. This repo currently installs only
#    the Codex adapter, so no warning is emitted when CLAUDE.md is absent.
if [ -f CLAUDE.md ]; then
  if grep -qE '@AGENTS\.md' CLAUDE.md; then
    ok "CLAUDE.md is the @AGENTS.md shim"
  else
    hard "CLAUDE.md exists but does not reference @AGENTS.md (shim broken)"
  fi
fi

# 2) Repo file paths named in the in-repo knowledge skill references actually
#    exist. Catches renames that orphan docs. Adjust SKILL_DIR + the top-level
#    dir allowlist to your project's layout.
SKILL_DIR="$(find .agents/skills -maxdepth 1 -type d -name '*-knowledge' 2>/dev/null | head -n1)"
if [ -n "$SKILL_DIR" ] && [ -d "$SKILL_DIR" ]; then
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    if [ -e "$p" ]; then
      ok "skill reference path exists: $p"
    else
      hard "skill references a path that does not exist: $p"
    fi
  done < <(
    grep -rhoE '`(src|extension|test|tests?|docs|specs|scripts|config)/[A-Za-z0-9._/-]+`' "$SKILL_DIR" 2>/dev/null \
      | tr -d '`' \
      | grep -vE '\*' \
      | sort -u
  )
fi

# ================ PROJECT-SPECIFIC REGISTRY CHECKS (edit me) =================
# The highest-value checks assert that machine-readable public surfaces are
# mentioned in docs.

# --- Express route registry parity (HARD) ------------------------------------
if [ -d src/backend/routes ]; then
  while IFS= read -r route; do
    [ -z "$route" ] && continue
    if grep -qF "$route" AGENTS.md README.md 2>/dev/null; then
      ok "API route documented: $route"
    else
      hard "API route '$route' is registered but missing from AGENTS.md/README.md"
    fi
  done < <(
    grep -RhoE 'router\.(get|post|put|patch|delete)\("[^"]+"' src/backend/routes 2>/dev/null \
      | sed -E 's/.*router\.[a-z]+\("([^"]+)".*/\1/' \
      | sed 's#^/$#/health#' \
      | sort -u
  )
fi

# --- Backend env contract parity (HARD) --------------------------------------
if [ -d src/backend ]; then
  while IFS= read -r key; do
    [ -z "$key" ] && continue
    if grep -qF "$key" README.md 2>/dev/null && grep -qE "^${key}=" .env.example 2>/dev/null; then
      ok "env key documented: $key"
    else
      hard "env key '$key' is read in backend code but missing from README.md or .env.example"
    fi
  done < <(
    grep -RhoE 'process\.env\.[A-Z0-9_]+' src/backend 2>/dev/null \
      | sed 's/process\.env\.//' \
      | sort -u
  )
fi

# --- Extension permission/host registry parity (HARD) ------------------------
if [ -f extension/manifest.json ] && command -v node >/dev/null 2>&1; then
  while IFS=$'\t' read -r kind value; do
    [ -z "$kind" ] && continue
    case "$kind" in
      permission)
        if grep -qF "$value" AGENTS.md 2>/dev/null; then
          ok "extension permission documented: $value"
        else
          hard "extension permission '$value' is in manifest.json but missing from AGENTS.md"
        fi
        ;;
      host)
        if grep -qF "$value" AGENTS.md README.md 2>/dev/null; then
          ok "extension host documented: $value"
        else
          hard "extension host '$value' is in manifest.json but missing from AGENTS.md/README.md"
        fi
        ;;
    esac
  done < <(
    node - <<'NODE'
const manifest = require("./extension/manifest.json");
for (const value of manifest.permissions || []) {
  console.log(`permission\t${value}`);
}
for (const value of manifest.host_permissions || []) {
  console.log(`host\t${value}`);
}
NODE
  )
fi

# --- Contributor command surface parity (SOFT) -------------------------------
if [ -f package.json ] && command -v node >/dev/null 2>&1; then
  while IFS= read -r script_name; do
    [ -z "$script_name" ] && continue
    if grep -qF "npm run $script_name" AGENTS.md README.md CONTRIBUTING.md 2>/dev/null \
      || grep -qF "npm $script_name" AGENTS.md README.md CONTRIBUTING.md 2>/dev/null; then
      ok "npm script documented: $script_name"
    else
      warn "npm script '$script_name' is not mentioned in AGENTS.md/README.md/CONTRIBUTING.md"
    fi
  done < <(
    node - <<'NODE'
const pkg = require("./package.json");
for (const name of Object.keys(pkg.scripts || {}).sort()) {
  console.log(name);
}
NODE
  )
fi

# --- Spec structure parity (HARD) -------------------------------------------
if [ -d specs ]; then
  while IFS= read -r spec_file; do
    [ -z "$spec_file" ] && continue
    for heading in \
      "## Problem Statement" \
      "## Solution" \
      "## User Stories" \
      "## Implementation Decisions" \
      "## Testing Decisions" \
      "## Out of Scope" \
      "## Further Notes"; do
      if grep -qF "$heading" "$spec_file" 2>/dev/null; then
        ok "spec heading present: $spec_file :: $heading"
      else
        hard "spec '$spec_file' is missing required heading: $heading"
      fi
    done
  done < <(find specs -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9]-*.md' | sort)
fi

# ============================================================================

echo "----"
if [ "$fail" -ne 0 ]; then
  echo "docs consistency check: FAILED"
  exit 1
fi
echo "docs consistency check: passed"
