#!/usr/bin/env bash
# Creates the GitHub repo (if it does not exist yet) and pushes this project to it.
#
# Needs one of:
#   * an authenticated gh CLI  ->  gh auth login
#   * a token in the environment  ->  export GH_TOKEN=ghp_...   (scope: repo)
#
# Usage:
#   ./scripts/publish.sh                       # Justichuu/argubot, public
#   OWNER=Justichuu REPO=argubot VISIBILITY=private ./scripts/publish.sh

set -euo pipefail

OWNER="${OWNER:-Justichuu}"
REPO="${REPO:-argubot}"
VISIBILITY="${VISIBILITY:-public}"
BRANCH="${BRANCH:-main}"
DESCRIPTION="${DESCRIPTION:-A funny, aggressively nonbiased argument bot. It argues both sides of anything and refuses to pick one.}"

cd "$(dirname "$0")/.."

say() { printf '\033[36m==>\033[0m %s\n' "$1"; }
die() { printf '\033[31merror:\033[0m %s\n' "$1" >&2; exit 1; }

TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
HAVE_GH=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  HAVE_GH=1
fi

if [ "$HAVE_GH" -eq 0 ] && [ -z "$TOKEN" ]; then
  die "no GitHub credentials found. Either run 'gh auth login' or export GH_TOKEN with 'repo' scope."
fi

say "running the test suite before publishing anything"
npm test >/dev/null || die "tests failed; refusing to publish"

if [ ! -d .git ]; then
  say "initialising a git repository"
  git init -q
fi

git symbolic-ref -q HEAD "refs/heads/$BRANCH" >/dev/null 2>&1 || git branch -M "$BRANCH" 2>/dev/null || true

if [ -n "$(git status --porcelain)" ]; then
  say "committing working tree"
  git add -A
  git -c user.email="${GIT_AUTHOR_EMAIL:-noreply@github.com}" \
      -c user.name="${GIT_AUTHOR_NAME:-$OWNER}" \
      commit -q -m "Add argubot: a structurally nonbiased argument bot"
fi

say "checking whether $OWNER/$REPO already exists"
EXISTS=0
if [ "$HAVE_GH" -eq 1 ]; then
  gh repo view "$OWNER/$REPO" >/dev/null 2>&1 && EXISTS=1
else
  CODE=$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$OWNER/$REPO")
  [ "$CODE" = "200" ] && EXISTS=1
fi

if [ "$EXISTS" -eq 1 ]; then
  say "repo already exists, pushing to it"
else
  say "creating $OWNER/$REPO ($VISIBILITY)"
  if [ "$HAVE_GH" -eq 1 ]; then
    gh repo create "$OWNER/$REPO" "--$VISIBILITY" --description "$DESCRIPTION" --disable-wiki
  else
    PRIVATE=false
    [ "$VISIBILITY" = "private" ] && PRIVATE=true
    curl -sf -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Accept: application/vnd.github+json' \
      https://api.github.com/user/repos \
      -d "{\"name\":\"$REPO\",\"description\":\"$DESCRIPTION\",\"private\":$PRIVATE,\"has_wiki\":false}" \
      >/dev/null || die "could not create the repo (is the token's 'repo' scope set, and is $OWNER the token's account?)"
  fi
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "https://github.com/$OWNER/$REPO.git"
else
  git remote add origin "https://github.com/$OWNER/$REPO.git"
fi

say "pushing $BRANCH to $OWNER/$REPO"
if [ "$HAVE_GH" -eq 1 ]; then
  gh auth setup-git >/dev/null 2>&1 || true
  git push -u origin "$BRANCH"
else
  git -c "http.https://github.com/.extraheader=Authorization: Bearer $TOKEN" push -u origin "$BRANCH"
fi

say "published: https://github.com/$OWNER/$REPO"
node bin/argubot.js "whether this repo should have been published" --plain --no-color || true
