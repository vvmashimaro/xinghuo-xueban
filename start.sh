#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
echo "星火学伴静态预览 → http://localhost:${PORT}/login.html"
if command -v npx >/dev/null 2>&1; then
  exec npx --yes serve . -p "$PORT"
fi
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
fi
echo "未找到 npx 或 python3，请手动启动静态服务器。" >&2
exit 1
