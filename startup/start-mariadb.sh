#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# MariaDB 独立启动脚本
# 用法:
#   ./start-mariadb.sh          # 前台运行，Ctrl+C 停止
#   ./start-mariadb.sh --daemon # 后台运行
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/env.conf"

# ─── MariaDB 安装路径（按实际安装位置修改）─────────────────────
MARIADB_HOME="/c/tools/mariadb-11.4.5-winx64"

# ─── 从 env.conf 读取端口 ──────────────────────────────────────
DB_PORT=3306
DB_DATABASE="morgana"
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    DB_PORT="${DB_PORT:-3306}"
    DB_DATABASE="${DB_DATABASE:-morgana}"
fi

DATA_DIR="$MARIADB_HOME/data"

# ─── 初始化（首次） ──────────────────────────────────────────────
if [ ! -f "$DATA_DIR/ibdata1" ]; then
    echo "正在初始化 MariaDB 数据目录 ..."

    # Try the modern name first, fall back to legacy name
    INIT_TOOL=""
    if [ -x "$MARIADB_HOME/bin/mariadb-install-db.exe" ]; then
        INIT_TOOL="$MARIADB_HOME/bin/mariadb-install-db.exe"
    elif [ -x "$MARIADB_HOME/bin/mysql_install_db.exe" ]; then
        INIT_TOOL="$MARIADB_HOME/bin/mysql_install_db.exe"
    else
        echo "错误：找不到初始化程序 (mariadb-install-db.exe / mysql_install_db.exe)"
        echo "  MARIADB_HOME=$MARIADB_HOME"
        echo "  请检查 MariaDB 安装路径是否正确"
        exit 1
    fi

    "$INIT_TOOL" --datadir="$DATA_DIR"
    if [ $? -ne 0 ]; then
        echo "初始化失败（退出码: $?）"
        echo "提示：如果报错 'No such file or directory'，说明 bash 无法运行 Windows 可执行文件。"
        echo "      请确保 start-mariadb.bat 使用的是 Git Bash，而非 WSL bash。"
        exit 1
    fi
    echo "初始化完成"
fi

# ─── 启动 ───────────────────────────────────────────────────────
echo "正在启动 MariaDB (端口 $DB_PORT) ..."
"$MARIADB_HOME/bin/mysqld.exe" \
    --datadir="$DATA_DIR" \
    --port="$DB_PORT" \
    --skip-grant-tables &
MYSQLD_PID=$!

# 等待就绪
for i in $(seq 1 20); do
    sleep 1
    "$MARIADB_HOME/bin/mysql.exe" -u root -h 127.0.0.1 --port="$DB_PORT" -e "SELECT 1" >/dev/null 2>&1
    if [ $? -eq 0 ]; then break; fi
done

# 创建数据库
"$MARIADB_HOME/bin/mysql.exe" -u root -h 127.0.0.1 --port="$DB_PORT" \
    -e "CREATE DATABASE IF NOT EXISTS \`$DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "MariaDB 就绪 (PID: $MYSQLD_PID, 端口: $DB_PORT)"

if [ "$1" = "--daemon" ]; then
    echo "后台模式，PID 文件: $SCRIPT_DIR/.mariadb.pid"
    echo "$MYSQLD_PID" > "$SCRIPT_DIR/.mariadb.pid"
    exit 0
fi

# 前台等待（Ctrl+C 停止）
echo "按 Ctrl+C 停止 MariaDB ..."
trap "echo '正在停止...'; \"$MARIADB_HOME/bin/mysqladmin.exe\" -u root -h 127.0.0.1 --port=$DB_PORT shutdown 2>/dev/null; exit 0" INT TERM
wait $MYSQLD_PID
