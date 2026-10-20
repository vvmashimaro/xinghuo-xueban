#!/usr/bin/env bash
#
# Daily backup of mentor proof uploads (佐证材料).
# Copies files whose modification time falls on a given calendar day (Asia/Shanghai)
# from the live upload cache into a durable directory outside the app deploy tree.
#
# Upload naming (proof-upload.js): {Date.now().toString(36)}-{random}{ext}
# We use mtime (set at fs.writeFileSync on upload), not the base36 prefix, to detect 昨日新增.
#
set -euo pipefail

SOURCE_DIR="${PROOF_SOURCE_DIR:-/www/xinghuo-app/server/uploads/proofs}"
BACKUP_ROOT="${PROOF_BACKUP_ROOT:-/www/xinghuo-data/proofs-backup}"
LOG_FILE="${PROOF_BACKUP_LOG:-/www/xinghuo-data/proofs-backup.log}"
export TZ="${PROOF_BACKUP_TZ:-Asia/Shanghai}"

DRY_RUN=0
TARGET_DAY=""

usage() {
  cat <<'EOF'
Usage: backup-proofs-daily.sh [--dry-run] [--date YYYY-MM-DD]

  --dry-run          Print actions only; do not copy or append to the log file.
  --date YYYY-MM-DD  Backup files from this calendar day (default: yesterday in TZ).

Environment overrides:
  PROOF_SOURCE_DIR   Live proofs directory (default: /www/xinghuo-app/server/uploads/proofs)
  PROOF_BACKUP_ROOT  Backup root (default: /www/xinghuo-data/proofs-backup)
  PROOF_BACKUP_LOG   One-line summary log (default: /www/xinghuo-data/proofs-backup.log)
  PROOF_BACKUP_TZ    Timezone for calendar days (default: Asia/Shanghai)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --date)
      TARGET_DAY="${2:-}"
      if [[ -z "$TARGET_DAY" ]]; then
        echo "backup-proofs-daily: --date requires YYYY-MM-DD" >&2
        exit 2
      fi
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "backup-proofs-daily: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$TARGET_DAY" ]]; then
  TARGET_DAY="$(date -d 'yesterday' '+%Y-%m-%d')"
fi

if ! date -d "$TARGET_DAY" '+%Y-%m-%d' >/dev/null 2>&1; then
  echo "backup-proofs-daily: invalid date: $TARGET_DAY" >&2
  exit 2
fi

NEXT_DAY="$(date -d "$TARGET_DAY + 1 day" '+%Y-%m-%d')"
DEST_DIR="${BACKUP_ROOT}/${TARGET_DAY}"
RANGE_START="${TARGET_DAY} 00:00:00"
RANGE_END="${NEXT_DAY} 00:00:00"

timestamp_iso() {
  date '+%Y-%m-%dT%H:%M:%S%z'
}

if [[ ! -d "$SOURCE_DIR" ]]; then
  msg="$(timestamp_iso) proofs-backup day=${TARGET_DAY} status=skip reason=source_missing source=${SOURCE_DIR}"
  echo "$msg"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "$msg" >>"$LOG_FILE" 2>/dev/null || true
  fi
  exit 0
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  mkdir -p "$DEST_DIR"
fi

copied=0
skipped=0
bytes=0

while IFS= read -r -d '' file; do
  base="$(basename "$file")"
  dest="${DEST_DIR}/${base}"

  if [[ -f "$dest" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  size=$(stat -c%s "$file" 2>/dev/null || echo 0)

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "would copy: ${file} -> ${dest} (${size} bytes)"
  else
    cp -a "$file" "$dest"
  fi

  copied=$((copied + 1))
  bytes=$((bytes + size))
done < <(
  find "$SOURCE_DIR" -maxdepth 1 -type f \
    -newermt "$RANGE_START" ! -newermt "$RANGE_END" \
    -print0 2>/dev/null || true
)

msg="$(timestamp_iso) proofs-backup day=${TARGET_DAY} dest=${DEST_DIR} copied=${copied} skipped=${skipped} bytes=${bytes} dry_run=${DRY_RUN}"
echo "$msg"

if [[ "$DRY_RUN" -eq 0 ]]; then
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
  echo "$msg" >>"$LOG_FILE" 2>/dev/null || true
fi

exit 0
