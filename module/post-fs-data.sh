#!/system/bin/sh
# Optional first-boot safety snapshot.
# Creates /data/adb/joyose-edit/backup/initial-<boot_ts>/ the first time the module
# runs on a new Joyose DB version, so there is always a pre-edit baseline to revert to.

MODDIR=${0%/*}
DATA_ROOT=/data/adb/joyose-edit
DB_DIR=/data/user/0/com.xiaomi.joyose/databases
STAMP_FILE="$DATA_ROOT/.bootstrap-version"

mkdir -p "$DATA_ROOT/backup"
chmod 700 "$DATA_ROOT"

[ -f "$DB_DIR/SmartP.db" ] || exit 0

# Fingerprint: mtime#size of SmartP.db — cheap, stable, no extra tools.
FP="$(stat -c '%Y#%s' "$DB_DIR/SmartP.db" 2>/dev/null)"
[ -n "$FP" ] || exit 0

LAST=""
[ -f "$STAMP_FILE" ] && LAST="$(cat "$STAMP_FILE" 2>/dev/null)"

if [ "$FP" = "$LAST" ]; then
  exit 0
fi

TARGET="$DATA_ROOT/backup/initial-$(date +%s)"
mkdir -p "$TARGET"
cp -f "$DB_DIR/SmartP.db" "$TARGET/SmartP.db" 2>/dev/null
cp -f "$DB_DIR/teg_config.db" "$TARGET/teg_config.db" 2>/dev/null
chmod 700 "$TARGET"
echo "$FP" > "$STAMP_FILE"
