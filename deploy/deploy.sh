#!/usr/bin/env bash
# Usage: bash deploy/deploy.sh /absolute/path/copied/from/1panel
set -euo pipefail

if [[ $# -ne 1 || "$1" != /* ]]; then
  printf 'Usage: bash deploy/deploy.sh /absolute/website/root\n' >&2
  exit 1
fi

source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
if [[ ! -d "$1" ]]; then
  printf 'Website directory does not exist. Create the static website in 1Panel first: %s\n' "$1" >&2
  exit 1
fi
site_root="$(cd -- "$1" && pwd -P)"
case "$site_root" in
  /|/etc|/usr|/var|/opt|/home|/root|"$source_dir")
    printf 'Refusing to use a system directory or source checkout as website root: %s\n' "$site_root" >&2
    exit 1
    ;;
esac
if [[ ! -w "$site_root" ]]; then
  printf 'Website directory is not writable. Run with an account that can write it: %s\n' "$site_root" >&2
  exit 1
fi

# The HTML goes last, so all referenced assets exist before publishing the page.
assets=(styles.css scene.css game-data.js scene.js game.js index.html)
for asset in "${assets[@]}"; do
  if [[ ! -f "$source_dir/$asset" ]]; then
    printf 'Missing source asset: %s\n' "$asset" >&2
    exit 1
  fi
done

backup_base="${AI_LANDLORD_BACKUP_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/ai-landlord/backups}"
mkdir -p -- "$backup_base"
backup_base="$(cd -- "$backup_base" && pwd -P)"
case "$backup_base/" in
  "$site_root/"*)
    printf 'Backup directory must be outside the public website root.\n' >&2
    exit 1
    ;;
esac
backup_dir="$(mktemp -d "$backup_base/$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
for asset in "${assets[@]}"; do
  if [[ -e "$site_root/$asset" ]]; then
    cp -p -- "$site_root/$asset" "$backup_dir/$asset"
  fi
done
if command -v git >/dev/null 2>&1; then
  git -C "$source_dir" rev-parse HEAD > "$backup_dir/source-commit.txt" 2>/dev/null || true
fi

for asset in "${assets[@]}"; do
  install -m 0644 -- "$source_dir/$asset" "$site_root/.$asset.deploy-tmp"
  mv -f -- "$site_root/.$asset.deploy-tmp" "$site_root/$asset"
done

printf 'Deployed the six game files to: %s\n' "$site_root"
printf 'Previous files backed up in: %s\n' "$backup_dir"
printf 'Expected website: https://landlord.luminestella.top\n'
printf 'Check DNS and HTTPS in 1Panel. Static file updates do not need an OpenResty reload.\n'
