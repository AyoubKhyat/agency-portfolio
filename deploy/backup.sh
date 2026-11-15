#!/usr/bin/env bash
# Daily backup: PostgreSQL dump + uploads archive, 14 days kept locally, optional off-server copy.
# Cron (as the deploy user):  15 3 * * *  /srv/ibda3/deploy/backup.sh >> /var/log/ibda3-backup.log 2>&1
# Off-server copy: set BACKUP_REMOTE to an rsync/scp target (e.g. user@host:/backups/ibda3).
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-/srv/backups/ibda3}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

docker compose exec -T db pg_dump -U ibda3 -d ibda3 -Fc > "$BACKUP_DIR/db-$STAMP.dump"
docker compose run --rm --no-deps -T -v "$BACKUP_DIR:/backup" --entrypoint tar app czf "/backup/uploads-$STAMP.tgz" -C /data uploads

# A dump that cannot be listed is not a backup.
docker compose exec -T db pg_restore --list < "$BACKUP_DIR/db-$STAMP.dump" > /dev/null

find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'uploads-*.tgz' \) -mtime +"$KEEP_DAYS" -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rsync -a --delete-after "$BACKUP_DIR/" "$BACKUP_REMOTE/"
fi
echo "$(date -Is) backup ok: db-$STAMP.dump"
