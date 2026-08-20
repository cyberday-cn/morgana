#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# MariaDB 独立停止脚本
# 用法: ./stop-db.sh
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/env.conf"
MARIADB_HOME="/c/tools/mariadb-11.4.5-winx64"
DB_PORT=3306

if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    DB_PORT="${DB_PORT:-3306}"
fi

echo "正在停止 MariaDB (端口 $DB_PORT) ..."

# 先尝试优雅关闭
if [ -f "$SCRIPT_DIR/.mariadb.pid" ]; then
    MYSQLD_PID=$(cat "$SCRIPT_DIR/.mariadb.pid")
    "$MARIADB_HOME/bin/mysqladmin.exe" -u root -h 127.0.0.1 --port="$DB_PORT" shutdown 2>/dev/null
    sleep 2
    kill "$MYSQLD_PID" 2>/dev/null
    rm -f "$SCRIPT_DIR/.mariadb.pid"
else
    "$MARIADB_HOME/bin/mysqladmin.exe" -u root -h 127.0.0.1 --port="$DB_PORT" shutdown 2>/dev/null
fi

echo "MariaDB 已停止"
