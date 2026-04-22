#!/system/bin/sh
# JoyoseEdit — KernelSU install script.
# Keeps the module scope narrow: sets up the private data dir and surfaces WebUI entry.

SKIPUNZIP=0

MODDIR="$MODPATH"
DATA_ROOT=/data/adb/joyose-edit

ui_print "- Creating module data directory at $DATA_ROOT"
mkdir -p "$DATA_ROOT/backup"
mkdir -p "$DATA_ROOT/history"
chmod 700 "$DATA_ROOT"
chmod 700 "$DATA_ROOT/backup"
chmod 700 "$DATA_ROOT/history"

# Ensure the root helper is executable.
if [ -f "$MODDIR/bin/joyose-edit.sh" ]; then
  set_perm "$MODDIR/bin/joyose-edit.sh" 0 0 0700
fi

ui_print "- WebUI entry: webroot/index.html"
ui_print "- Target Joyose package: com.xiaomi.joyose"
ui_print "- Supported DB path:"
ui_print "    /data/user/0/com.xiaomi.joyose/databases/SmartP.db"
ui_print "    /data/user/0/com.xiaomi.joyose/databases/teg_config.db"
ui_print ""
ui_print "  Open the module in KernelSU manager to launch the WebUI."
