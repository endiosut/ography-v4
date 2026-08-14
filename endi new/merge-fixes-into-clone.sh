#!/usr/bin/env bash
# Reconcile the surviving working-copy source into a fresh clone of ography-v4.
#
# SAFETY MODEL
#   - Never runs on `main`. Creates and switches to a branch first.
#   - Copies ONLY src/. Config, package.json, public/ and supabase/ come from
#     the repo, which is authoritative for them.
#   - Refuses to touch .env* — those are gitignored and must stay local.
#   - Dry-run by default. Prints the full file-level diff and stops.
#     Re-run with --apply to actually write.
#
# USAGE
#   bash merge-fixes-into-clone.sh            # dry run, shows what would change
#   bash merge-fixes-into-clone.sh --apply    # perform the merge
set -euo pipefail

CLONE="${CLONE:-/sessions/festive-zen-wright/mnt/01-Ography/ography-v4}"
SRC="${SRC:-/sessions/festive-zen-wright/mnt/01-Ography/03-Source}"
BRANCH="recover/reconcile-2026-08-12"
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ── preflight ───────────────────────────────────────────────────────────────
[[ -d "$CLONE/.git" ]] || { echo "FATAL: $CLONE is not a git repo. Clone first."; exit 1; }
[[ -d "$SRC/src"    ]] || { echo "FATAL: $SRC/src not found."; exit 1; }

cd "$CLONE"
say "Repository state"
git log --oneline -3
echo "HEAD: $(git rev-parse --short HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "FATAL: clone has uncommitted changes. Investigate before merging."
  git status --short
  exit 1
fi
echo "Working tree clean."

# ── what differs ────────────────────────────────────────────────────────────
say "File-level differences (repo src/  vs  working-copy src/)"
diff -rq "$CLONE/src" "$SRC/src" 2>/dev/null | sed 's/^/  /' || true

say "Files present in working copy but NOT in repo (new files)"
( cd "$SRC/src" && find . -type f \( -name '*.ts' -o -name '*.tsx' \) | sort ) > /tmp/_src.txt
( cd "$CLONE/src" && find . -type f \( -name '*.ts' -o -name '*.tsx' \) | sort ) > /tmp/_clone.txt
comm -23 /tmp/_src.txt /tmp/_clone.txt | sed 's/^/  + /' || true

say "Files present in repo but NOT in working copy (would be LEFT ALONE, not deleted)"
comm -13 /tmp/_src.txt /tmp/_clone.txt | sed 's/^/  - /' || true

say "package.json dependency delta (repo -> working copy)"
if command -v node >/dev/null; then
  node -e '
    const a=require("'"$CLONE"'/package.json"), b=require("'"$SRC"'/package.json");
    const keys=new Set([...Object.keys(a.dependencies||{}),...Object.keys(b.dependencies||{}),
                        ...Object.keys(a.devDependencies||{}),...Object.keys(b.devDependencies||{})]);
    let n=0;
    for(const k of [...keys].sort()){
      const av=(a.dependencies||{})[k]||(a.devDependencies||{})[k];
      const bv=(b.dependencies||{})[k]||(b.devDependencies||{})[k];
      if(av!==bv){ console.log(`  ${k}: ${av||"(absent)"} -> ${bv||"(absent)"}`); n++; }
    }
    if(!n) console.log("  identical");
  '
fi

if [[ $APPLY -eq 0 ]]; then
  say "DRY RUN — nothing written. Re-run with --apply to perform the merge."
  exit 0
fi

# ── apply ───────────────────────────────────────────────────────────────────
say "Creating branch $BRANCH"
git checkout -b "$BRANCH"

say "Copying src/ (additive + overwrite; no deletions)"
# -a preserves structure; no --delete, so repo-only files survive for review.
cp -a "$SRC/src/." "$CLONE/src/"

# Never let a local env file slip in.
find "$CLONE/src" -name '.env*' -delete 2>/dev/null || true

say "Result"
git status --short

say "Diff stat"
git diff --stat

say "DONE. Nothing committed yet — review, then:"
cat <<'EOF'

  npm install
  npm run build          # route table MUST show f (dynamic) for /portal /admin /login
  git add -A
  git commit -m "Recover 10 weeks of untracked work + auth/portal fixes

- portal: createBrowserClient (cookies) not createClient (localStorage) - root cause
- portal: client resolved by user_id, maybeSingle, stage vocab matched to DB
- portal: deliverables/payments/deadline/project_ref rendered; error screen has exits
- middleware: rotated auth cookies carried across every redirect
- middleware: matcher narrowed; NextResponse.next({request}); admin via app_metadata.role
- login: navigate only after session cookie is readable
- layouts: force-dynamic on portal/admin/login segments (ignored in client components)"
  git push -u origin HEAD

EOF
