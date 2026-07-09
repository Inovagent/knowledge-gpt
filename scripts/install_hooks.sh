#!/usr/bin/env bash
#
# install_hooks.sh - install the git side of the Docs Impact guard.
#
# git is the one choke point every tool and every human converges on, so this is
# the layer that makes the system model-agnostic by construction. Run once per
# clone:  bash scripts/install_hooks.sh
#
# Installs:
#   pre-commit   advisory reminder (never blocks) - early heads-up while staging.
#   commit-msg   the real gate: blocks a commit that stages hot paths with no doc
#                change unless the message carries a `Docs-Impact: none - <reason>`
#                trailer. The trailer lands in history, so drift is grep-able.

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

HOOKS_DIR="$(git rev-parse --git-path hooks)"
mkdir -p "$HOOKS_DIR"

install_hook() {
  local hook_name="$1"
  local target="$HOOKS_DIR/$hook_name"
  local legacy="$HOOKS_DIR/$hook_name.docs-impact-legacy"
  local marker="Managed by scripts/install_hooks.sh - Docs Impact"

  if [ -e "$target" ] && ! grep -qF "$marker" "$target" 2>/dev/null; then
    if [ -e "$legacy" ]; then
      echo "Refusing to replace existing $hook_name hook because $legacy already exists." >&2
      echo "Move or merge one of those hooks manually, then rerun scripts/install_hooks.sh." >&2
      exit 1
    fi

    mv "$target" "$legacy"
    chmod +x "$legacy" 2>/dev/null || true
    echo "Preserved existing $hook_name hook as $legacy"
  fi

  cat > "$target" <<HOOK
#!/usr/bin/env bash
# $marker
set -euo pipefail

HOOK_NAME="$hook_name"
REPO_ROOT="\$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "\$REPO_ROOT"

case "\$HOOK_NAME" in
  pre-commit)
    bash scripts/docs_impact_guard.sh --staged
    ;;
  commit-msg)
    bash scripts/docs_impact_guard.sh --commit-msg "\${1:-}"
    ;;
esac

LEGACY_HOOK="\$(git rev-parse --git-path "hooks/\${HOOK_NAME}.docs-impact-legacy" 2>/dev/null || printf '%s' ".git/hooks/\${HOOK_NAME}.docs-impact-legacy")"
if [ -x "\$LEGACY_HOOK" ]; then
  exec "\$LEGACY_HOOK" "\$@"
fi

exit 0
HOOK
  chmod +x "$target"
}

install_hook pre-commit
install_hook commit-msg

echo "Installed pre-commit (advisory) and commit-msg (gate) hooks in $HOOKS_DIR"
echo "Bypass a single commit with: git commit --no-verify"
