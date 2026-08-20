#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Morgana（蜃楼）系统停止脚本（Linux / macOS）
# 按端口查找并停止后端和前端服务
# 用法: ./stop-all.sh
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/env.conf"
LOG_DIR="$SCRIPT_DIR/logs"
RUNNING_FILE="$LOG_DIR/.running"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
GRAY='\033[2m'; NC='\033[0m'

# ─── 加载配置 ──────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then source "$ENV_FILE"; fi
SERVER_PORT="${SERVER_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Morgana（蜃楼）系统停止                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── 查找端口对应的进程 PID ──────────────────────────────────
# lsof 输出: "node  12345  user  3u  IPv4 xxxxxx      0t0  TCP *:3001 (LISTEN)"
find_pid_by_port() {
    lsof -ti :"$1" 2>/dev/null
}

# ─── 停止服务 ──────────────────────────────────────────────────
stop_service() {
    local name=$1 port=$2
    local pid
    pid=$(find_pid_by_port "$port")
    if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null
        echo -e "  ${GREEN}${name} 进程已停止 (端口 $port)${NC}"
    else
        echo -e "  ${GRAY}${name}: 未发现运行中的进程${NC}"
    fi
}

# ─── 停止前端 ──────────────────────────────────────────────────
echo -e "${YELLOW}[1/2] 停止前端 ...${NC}"
stop_service "前端" "$FRONTEND_PORT"

# ─── 停止后端 ──────────────────────────────────────────────────
echo -e "${YELLOW}[2/2] 停止后端 ...${NC}"
stop_service "后端" "$SERVER_PORT"

# ─── 清理孤立的 Vite 进程 ─────────────────────────────────────
echo -e "${YELLOW}[3/3] 清理残留的前端进程 ...${NC}"
vite_pids=$(pgrep -f "vite.*$(basename "$PROJECT_ROOT")/frontend" 2>/dev/null || true)
if [ -n "$vite_pids" ]; then
    kill $vite_pids 2>/dev/null
    echo -e "  ${GREEN}已清理残留的前端进程${NC}"
else
    echo -e "  ${GRAY}未发现残留进程${NC}"
fi

rm -f "$RUNNING_FILE"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                     系统已停止                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
