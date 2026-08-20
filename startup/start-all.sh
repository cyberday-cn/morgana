#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Morgana（蜃楼）系统启动脚本
# 读取 startup/env.conf，启动后端和前端服务（不包含数据库）
# 用法: ./start-all.sh
# ═══════════════════════════════════════════════════════════════

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/env.conf"
LOG_DIR="$SCRIPT_DIR/logs"
RUNNING_FILE="$LOG_DIR/.running"
mkdir -p "$LOG_DIR"

# ─── 颜色 ──────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
GRAY='\033[2m'; RED='\033[0;31m'; NC='\033[0m'

# ─── 加载配置 ──────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}[ERROR] 配置文件不存在: $ENV_FILE${NC}"
    exit 1
fi
source "$ENV_FILE"

SERVER_PORT="${SERVER_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Morgana（蜃楼）系统启动                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Step 1: 启动后端 ──────────────────────────────────────────
echo -e "${YELLOW}[1/2] 启动后端 ...${NC}"
BACKEND_DIR="$PROJECT_ROOT/backend"
BACKEND_LOG="$LOG_DIR/backend.log"
rm -f "$BACKEND_LOG"

cd "$BACKEND_DIR"
export DB_HOST DB_PORT DB_DATABASE DB_USER DB_PASSWORD
export SERVER_PORT

npx tsx watch src/index.ts > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo -e "  ${GRAY}后端启动中 (端口 $SERVER_PORT)  PID: $BACKEND_PID${NC}"
sleep 3

# ─── Step 2: 启动前端 ──────────────────────────────────────────
echo -e "${YELLOW}[2/2] 启动前端 ...${NC}"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
FRONTEND_LOG="$LOG_DIR/frontend.log"
rm -f "$FRONTEND_LOG"

cd "$FRONTEND_DIR"
npx vite --port "$FRONTEND_PORT" --strictPort > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo -e "  ${GRAY}前端启动中 (端口 $FRONTEND_PORT)  PID: $FRONTEND_PID${NC}"
sleep 3

# ─── 保存进程信息 ──────────────────────────────────────────────
cat > "$RUNNING_FILE" <<EOF
BACKEND_PID=$BACKEND_PID
FRONTEND_PID=$FRONTEND_PID
EOF

# ─── 结果 ──────────────────────────────────────────────────────
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                     启动完成                                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  后端:    http://localhost:${SERVER_PORT}"
echo -e "  前端:    http://localhost:${FRONTEND_PORT}"
echo ""
echo -e "  ${GRAY}查看日志:${NC}"
echo -e "  ${GRAY}  tail -20 $BACKEND_LOG${NC}"
echo -e "  ${GRAY}  tail -20 $FRONTEND_LOG${NC}"
echo -e ""
echo -e "  ${YELLOW}停止系统: ./stop-all.sh${NC}"
