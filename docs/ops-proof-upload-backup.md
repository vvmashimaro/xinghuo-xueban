# 佐证材料每日本地备份 · Daily proof upload backup

## 产品说明 / Product intent

上传接口仍将文件写入应用目录下的即时缓存；**次日凌晨**把**上一自然日**新增的文件复制到生产机本地盘上的持久目录，与代码部署目录分离，避免 `rsync` 部署误删或改权限。

The live upload path is unchanged. A scheduled job copies **only files added on the previous calendar day** into a durable backup tree **outside** the app deploy directory.

---

## 路径 / Paths

| 角色 | 生产默认路径 |
|------|----------------|
| 即时缓存（API 写入，勿在部署时覆盖） | `/www/xinghuo-app/server/uploads/proofs/` |
| 每日备份根目录 | `/www/xinghuo-data/proofs-backup/` |
| 某日备份子目录 | `/www/xinghuo-data/proofs-backup/YYYY-MM-DD/`（`YYYY-MM-DD` 为**源文件所属自然日**，即「昨日」） |
| 汇总日志（可选） | `/www/xinghuo-data/proofs-backup.log` |

仓库内脚本：`_platform/server/scripts/backup-proofs-daily.sh`

备份目录**不要**挂到 `express.static`；仅运维本机访问。

---

## 「昨日新增」如何判定 / How “yesterday’s new files” is detected

`proof-upload.js` 落盘文件名形如 `{Date.now().toString(36)}-{random}.jpg`（上传时刻的 base36 时间戳 + 随机后缀），**不**从文件名反解日期。

备份脚本使用 **`mtime`（修改时间）**，在时区 `Asia/Shanghai` 下落在目标自然日 `[00:00:00, 次日 00:00:00)` 的文件（与 `fs.writeFileSync` 写入时刻一致）。重跑同一天备份时，目标目录已存在的同名文件会 **跳过**（`cp` 前检查），保证幂等。

---

## 安装 / Install (OpenCloudOS / 宝塔, pm2 user `www`)

1. **部署脚本到生产机**（随正常发版拉取仓库即可）：

   ```bash
   chmod +x /www/xinghuo-app/server/scripts/backup-proofs-daily.sh
   ```

2. **创建备份目录并授权**（仅需一次）：

   ```bash
   mkdir -p /www/xinghuo-data/proofs-backup
   chown -R www:www /www/xinghuo-data/proofs-backup
   chmod 750 /www/xinghuo-data/proofs-backup
   ```

3. **Crontab**（推荐每天 02:15 上海时间备份「昨天」）：

   ```cron
   # 佐证材料：每日备份昨日新增上传
   15 2 * * * TZ=Asia/Shanghai /www/xinghuo-app/server/scripts/backup-proofs-daily.sh >>/www/xinghuo-data/proofs-backup-cron.log 2>&1
   ```

   若使用 **root** 的 crontab，建议以 `www` 执行，避免备份文件属主与 API 不一致：

   ```cron
   15 2 * * * TZ=Asia/Shanghai sudo -u www /www/xinghuo-app/server/scripts/backup-proofs-daily.sh >>/www/xinghuo-data/proofs-backup-cron.log 2>&1
   ```

   也可在宝塔「计划任务」中填相同命令与时区。

4. **环境变量**（可选，覆盖默认路径）：

   - `PROOF_SOURCE_DIR`
   - `PROOF_BACKUP_ROOT`
   - `PROOF_BACKUP_LOG`
   - `PROOF_BACKUP_TZ`（默认 `Asia/Shanghai`）

---

## 部署 / rsync 注意

无论是否使用 `deploy-xinghuo.sh` 等脚本，发布到生产时请：

- **排除** `server/uploads/`（或整个 `uploads`），不要用部署包覆盖线上已上传文件；
- **不要**把 `/www/xinghuo-data/` 纳入会被 `--delete` 同步的目标树。

生产一键部署脚本见仓库根目录 **`scripts/deploy-xinghuo.sh`**（生产机通常为 `/root/deploy-xinghuo.sh`，请与仓库保持同步）。脚本已：
- rsync API 时 **排除** `uploads/`；
- 在 pm2 重载前 **`mkdir -p uploads/proofs` + `chown -R www:www uploads`**，避免 tarball 部署后属主为 root 导致 EACCES。

---

##  dry-run / 本地验证

**演练（不写盘、不写日志文件）：**

```bash
/www/xinghuo-app/server/scripts/backup-proofs-daily.sh --dry-run
```

**指定某一天（例如补跑 2026-10-19）：**

```bash
TZ=Asia/Shanghai /www/xinghuo-app/server/scripts/backup-proofs-daily.sh --date 2026-10-19
```

**在开发机用临时目录自测：**

```bash
cd /path/to/repo/_platform/server
TMP="$(mktemp -d)"
SRC="$TMP/source/proofs"
DST="$TMP/backup"
mkdir -p "$SRC"
# 模拟「昨天」的文件：touch -d
touch -d 'yesterday 12:00' "$SRC/test-yesterday.jpg"
touch "$SRC/test-today.jpg"

PROOF_SOURCE_DIR="$SRC" \
PROOF_BACKUP_ROOT="$DST" \
PROOF_BACKUP_LOG="$TMP/backup.log" \
  bash scripts/backup-proofs-daily.sh

ls -la "$DST/$(date -d yesterday +%Y-%m-%d)/"
```

预期：仅 `test-yesterday.jpg` 被复制；再次执行同一命令时 `skipped=1`、`copied=0`。

---

## 日志示例 / Log line

```
2026-10-21T02:15:01+0800 proofs-backup day=2026-10-20 dest=/www/xinghuo-data/proofs-backup/2026-10-20 copied=3 skipped=0 bytes=245760 dry_run=0
```

---

## 相关代码 / Related code

- 上传：`POST /api/uploads/proof` → `_platform/server/src/proof-upload.js` → `server/uploads/proofs/`
- 静态访问：`/uploads/...`（仅即时缓存目录，不含备份目录）
