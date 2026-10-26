#!/usr/bin/env bash
# 星火学伴 · 一键重新部署（Web 静态 + Node API）
# 用法：/root/deploy-xinghuo.sh [branch]            默认 main
#       DEPLOY_SOURCE=tarball /root/deploy-xinghuo.sh  强制走 codeload 压缩包（github.com git 不通时）
#  1) 部署前备份数据  2) 拉取代码：git fetch（github.com 在国内时通时断）失败则自动改用 codeload.github.com 压缩包
#  3) 同步 API 代码到运行目录 /www/xinghuo-app/server（不含 data/.env/node_modules）
#  4) 依赖变化时 npm ci --omit=dev  5) 修正 uploads 属主  6) pm2 重载 + 健康检查  7) nginx -t && reload
#
# 仓库副本：scripts/deploy-xinghuo.sh — 生产机请保持 /root/deploy-xinghuo.sh 与本文件一致。
set -Eeuo pipefail
BRANCH="${1:-main}"
GH_REPO=vvmashimaro/xinghuo-xueban
REPO=/www/wwwroot/xinghuo
APP=/www/xinghuo-app
DATA=/www/xinghuo-data
NODE_BIN=/www/server/nodejs/v22.23.3/bin
UPLOADS="$APP/server/uploads"
UPLOAD_OWNER="${UPLOAD_OWNER:-www:www}"
export PATH="$NODE_BIN:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" HOME=/root
unset NODE_ENV
umask 022

log() { echo "[$(date '+%F %T')] $*"; }
exec 9>/run/deploy-xinghuo.lock
flock -n 9 || { log "另一个部署正在进行"; exit 1; }

log "部署前备份数据"
/root/backup-xinghuo.sh pre-deploy || log "WARN: 备份失败（继续）"

cd "$REPO"
OLD=$(cut -d' ' -f1 "$APP/DEPLOYED_REVISION" 2>/dev/null || git rev-parse --short HEAD)

fetch_git() {
  local i
  for i in 1 2 3; do
    if timeout 90 git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=20 fetch --prune origin "$BRANCH"; then
      return 0
    fi
    log "git fetch 失败（第 $i 次）"; sleep 3
  done
  return 1
}

METHOD=git
if [ "${DEPLOY_SOURCE:-git}" != "tarball" ] && fetch_git; then
  # 部署目录不做本地修改：直接对齐远端分支（BT 生成的 404.html/.user.ini/.htaccess 在 .git/info/exclude 中，不受影响）
  git checkout -q -B "$BRANCH" "origin/$BRANCH"
  git reset -q --hard "origin/$BRANCH"
  NEW=$(git rev-parse --short HEAD)
else
  METHOD=tarball
  log "github.com 不可达，改用 codeload.github.com 压缩包"
  SHA=$(curl -fsS -m 30 --retry 3 "https://api.github.com/repos/$GH_REPO/commits/$BRANCH" \
        | python3 -c 'import json,sys; print(json.load(sys.stdin)["sha"])')
  TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
  curl -fsSL -m 600 --retry 3 -o "$TMP/src.tgz" "https://codeload.github.com/$GH_REPO/tar.gz/$SHA"
  mkdir "$TMP/src"; tar -xzf "$TMP/src.tgz" -C "$TMP/src" --strip-components=1
  [ -f "$TMP/src/login.html" ] && [ -f "$TMP/src/_platform/server/package.json" ] || { log "压缩包内容异常"; exit 1; }
  rsync -a --delete --exclude '/.git' --exclude '/404.html' --exclude '/.user.ini' --exclude '/.htaccess' "$TMP/src/" "$REPO/"
  NEW=${SHA:0:7}
fi
echo "$NEW $METHOD $(date -Iseconds)" > "$APP/DEPLOYED_REVISION"
log "代码: $OLD -> $NEW (via $METHOD)"

log "同步 API 代码到 $APP/server"
rsync -a --delete \
  --exclude '/data' --exclude '/node_modules' --exclude '/.env' --exclude '/keys' --exclude '/.deps.sha256' \
  --exclude '/uploads' \
  "$REPO/_platform/server/" "$APP/server/"
[ -L "$APP/server/data" ] || { rm -rf "$APP/server/data"; ln -s "$DATA" "$APP/server/data"; }

cd "$APP/server"
LOCK_SUM=$(cat package.json package-lock.json 2>/dev/null | sha256sum | cut -d' ' -f1)
if [ ! -d node_modules ] || [ "$(cat .deps.sha256 2>/dev/null)" != "$LOCK_SUM" ]; then
  log "安装依赖 (npm ci --omit=dev)"
  npm ci --omit=dev --no-audit --no-fund
  echo "$LOCK_SUM" > .deps.sha256
else
  log "依赖无变化，跳过 npm ci"
fi

log "确保 uploads 目录存在且属主为 $UPLOAD_OWNER（避免 pm2/www 进程 EACCES）"
mkdir -p "$UPLOADS/proofs"
if chown -R "$UPLOAD_OWNER" "$UPLOADS"; then
  log "uploads 属主已设为 $UPLOAD_OWNER"
else
  log "WARN: chown $UPLOADS 失败，请手动执行 chown -R $UPLOAD_OWNER $UPLOADS"
fi

log "pm2 重载 xinghuo-api"
pm2 startOrReload "$APP/ecosystem.config.js" --update-env
pm2 save >/dev/null

sleep 2
for i in $(seq 1 20); do
  if curl -fsS -m 3 http://127.0.0.1:8787/api/health >/dev/null; then
    log "API 健康检查通过"; break
  fi
  if [ "$i" -eq 20 ]; then
    log "API 健康检查失败！最近日志："; pm2 logs xinghuo-api --lines 40 --nostream || true
    log "回滚提示：cd $REPO && git reset --hard $OLD 后重新执行 $0（或 DEPLOY_SOURCE=tarball 指定版本）"
    exit 1
  fi
  sleep 1
done

/www/server/nginx/sbin/nginx -t -q && /etc/init.d/nginx reload >/dev/null
sleep 1
curl -fsS -m 5 -o /dev/null -w "nginx :80 /api/health -> HTTP %{http_code}\n" -H 'Host: 122.51.58.105' http://127.0.0.1/api/health || true
log "部署完成 ($NEW via $METHOD)"
