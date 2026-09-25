#!/usr/bin/env bash
# Coarse docs-impact evidence check. It does not prove semantic correctness.
# Configure the doc/test regexes and trigger file for the target repository.
set -uo pipefail

HOT_PATHS_FILE="scripts/docs_hot_paths.txt"
DOC_PATHS_RE='^(AGENTS\.md$|README\.md$|docs/)'
TEST_RE='((^|/)(tests?|spec|__tests__)/|_test\.|\.test\.|\.spec\.|(^|/)test_[^/]+\.)'

error() { printf 'docs_impact_guard: %s\n' "$*" >&2; exit 2; }
mode="stop"
message=""
case "${1:-}" in
  "") [ "$#" -eq 0 ] || error "unexpected arguments" ;;
  --worktree) mode="check"; [ "$#" -eq 1 ] || error "unexpected arguments" ;;
  --check|--staged|--ci) mode="${1#--}"; [ "$#" -eq 1 ] || error "unexpected arguments" ;;
  --commit-msg) mode="commit-msg"; [ "$#" -eq 2 ] || error "--commit-msg needs a file"; message="$2" ;;
  *) error "unknown mode: $1" ;;
esac
# Resolve a relative commit-message argument before changing cwd.
if [ "$mode" = "commit-msg" ]; then
  [ -f "$message" ] && [ -r "$message" ] || error "cannot read commit message"
  case "$message" in /*) ;; *) message="$PWD/$message" ;; esac
fi
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)" || error "cannot locate repository"
cd "$REPO_ROOT" || error "cannot enter repository"
root="$(git rev-parse --show-toplevel 2>/dev/null)" || error "not a Git working tree"
[ "$(cd "$root" && pwd -P)" = "$REPO_ROOT" ] || error "install guard under the repository's scripts/"

validate_re() {
  printf '' | grep -E "$1" >/dev/null 2>&1
  [ "$?" -le 1 ] || error "invalid regex in $2"
}
[ -r "$HOT_PATHS_FILE" ] || error "missing trigger file: $HOT_PATHS_FILE"
hot_re=""
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue ;; esac
  validate_re "$line" "$HOT_PATHS_FILE"
  if [ -n "$hot_re" ]; then hot_re="$hot_re|($line)"; else hot_re="($line)"; fi
done < "$HOT_PATHS_FILE"
[ -n "$hot_re" ] || error "no active triggers; configure $HOT_PATHS_FILE"
[ -n "$DOC_PATHS_RE" ] && [ -n "$TEST_RE" ] || error "doc and test patterns must be nonempty"
validate_re "$DOC_PATHS_RE" DOC_PATHS_RE
validate_re "$TEST_RE" TEST_RE

tmp="$(mktemp -d "${TMPDIR:-/tmp}/docs-impact.XXXXXX")" || error "cannot create temporary directory"
trap 'rm -rf "$tmp"' EXIT
: > "$tmp/changed"
: > "$tmp/docs"
collect_diff() {
  git diff --no-ext-diff --no-renames --name-only -z "$@" -- >> "$tmp/changed" || error "cannot read Git diff"
  git diff --no-ext-diff --no-renames --name-only -z --diff-filter=ACMRT "$@" -- >> "$tmp/docs" || error "cannot read documentation diff"
}
case "$mode" in
  stop|check)
    if git rev-parse --verify HEAD >/dev/null 2>&1; then
      collect_diff HEAD
    else
      collect_diff --cached
      collect_diff
    fi
    git ls-files --others --exclude-standard -z > "$tmp/untracked" || error "cannot read untracked paths"
    cat "$tmp/untracked" >> "$tmp/changed"
    cat "$tmp/untracked" >> "$tmp/docs"
    ;;
  staged|commit-msg) collect_diff --cached ;;
  ci)
    base="${BASE_REF:-origin/main}"
    baseline="$(git merge-base "$base" HEAD 2>/dev/null)" || error "cannot resolve CI merge base: $base"
    collect_diff "$baseline" HEAD
    ;;
esac
# Categories use: name<TAB>hot-path ERE<TAB>acceptable canonical-doc ERE.
# Each affected category needs its own document evidence or a reasoned exception.
MAP_FILE="scripts/docs_contract_map.tsv"
[ -r "$MAP_FILE" ] || error "missing contract map: $MAP_FILE"
names=(); sources=(); destinations=()
while IFS=$'\t' read -r category source destination extra || [ -n "$category" ]; do
  case "$category" in ''|\#*) continue ;; esac
  [ -n "$source" ] && [ -n "$destination" ] && [ -z "${extra:-}" ] || error "invalid contract-map row: $category"
  validate_re "$source" "$MAP_FILE"
  validate_re "$destination" "$MAP_FILE"
  names+=("$category"); sources+=("$source"); destinations+=("$destination")
done < "$MAP_FILE"
[ "${#names[@]}" -gt 0 ] || error "empty contract map"
hot=(); missing=()
while IFS= read -r -d '' path; do
  if [[ "$path" =~ $hot_re ]] && ! [[ "$path" =~ $TEST_RE ]]; then hot+=("$path"); fi
done < "$tmp/changed"
marker="$(git rev-parse --git-path docs_impact_reminded)" || error "cannot resolve reminder marker"
if [ "${#hot[@]}" -eq 0 ]; then
  if [ "$mode" = stop ]; then rm -f "$marker"; fi
  exit 0
fi
has_doc() {
  local pattern="$1" path
  while IFS= read -r -d '' path; do
    # A deleted file (including an unstaged deletion after staging) is not evidence.
    if [ -f "$path" ] && [[ "$path" =~ $pattern ]]; then return 0; fi
  done < "$tmp/docs"
  return 1
}
for path in "${hot[@]}"; do
  matched=0
  for ((i=0; i<${#names[@]}; i++)); do
    if [[ "$path" =~ ${sources[$i]} ]]; then
      matched=1
      if ! has_doc "${destinations[$i]}"; then missing+=("${names[$i]}: $path -> ${destinations[$i]}"); fi
    fi
  done
  if [ "$matched" -eq 0 ] && ! has_doc "$DOC_PATHS_RE"; then missing+=("other documented contract: $path -> $DOC_PATHS_RE"); fi
done
if [ "${#missing[@]}" -eq 0 ]; then
  if [ "$mode" = stop ]; then rm -f "$marker"; fi
  exit 0
fi

has_declaration() {
  grep -iE '^docs[ -]?impact:[[:space:]]*none[[:space:]]+(—|-)[[:space:]]*[^[:space:]].*$' >/dev/null
}
if [ "$mode" = "commit-msg" ] && has_declaration < "$message"; then exit 0; fi
if [ "$mode" = "ci" ] && printf '%s\n' "${DOCS_IMPACT_TEXT:-}" | has_declaration; then exit 0; fi

show_reminder() {
printf 'Docs Impact: review these changed contract candidates:\n' >&2
printf '  %q\n' "${missing[@]}" >&2
printf '%s\n' 'Update the mapped canonical document if its fact changed; otherwise explain why no docs update is needed.' >&2
}
case "$mode" in
  stop)
    # Include the baseline, tracked content and still-present untracked hot files.
    # Never read unrelated untracked files or persist their contents.
    {
      git rev-parse HEAD 2>/dev/null || printf 'unborn\n'
      git diff --no-ext-diff --binary HEAD -- "${hot[@]}" 2>/dev/null || git diff --no-ext-diff --binary -- "${hot[@]}"
      for path in "${hot[@]}"; do
        printf '%s\0' "$path"
        if [ -f "$path" ]; then git hash-object -- "$path" || exit 1; fi
      done
    } > "$tmp/state" || error "cannot fingerprint changed content"
    state_hash="$(git hash-object "$tmp/state")" || error "cannot hash reminder state"
    if [ -f "$marker" ] && [ "$(cat "$marker")" = "$state_hash" ]; then exit 0; fi
    printf '%s' "$state_hash" > "$marker" || error "cannot save reminder state"
    show_reminder
    printf '%s\n' 'First reminder for this change; repeated unchanged stops will proceed.' >&2
    exit 2 ;;
  staged) show_reminder; printf '%s\n' 'Advisory only; evaluate the repository docs-impact mapping.' >&2; exit 0 ;;
  commit-msg) show_reminder; printf '%s\n' 'Add Docs-Impact: none — <specific reason> to the commit message for a justified exception.' >&2 ;;
  ci) show_reminder; printf '%s\n' 'Add Docs-Impact: none — <specific reason> to the PR body for a justified exception.' >&2 ;;
  check) show_reminder ;;
esac
exit 1
