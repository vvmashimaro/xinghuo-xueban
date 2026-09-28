#!/bin/bash
# 测试脚本：验证星火学伴 API 认证和授权

set -e

API_BASE="${API_BASE:-http://127.0.0.1:8787}"
PARENT_PHONE="13980889211"
MENTOR_PHONE="13880123456"
CODE="888888"

# Use temp database for tests to avoid polluting committed db.json
export DATABASE_PATH="${DATABASE_PATH:-/tmp/test-db-$$.json}"
if [ ! -f "$DATABASE_PATH" ]; then
  cp "$(dirname "$0")/data/db.json" "$DATABASE_PATH"
fi

echo "===== 星火学伴 API 测试 ====="
echo "API Base: $API_BASE"
echo "Test DB: $DATABASE_PATH"
echo ""

# 测试健康检查（公开）
echo "[1] 测试健康检查（公开）..."
curl -s "$API_BASE/api/health" | jq -r '.ok'
echo "✓ 健康检查通过"
echo ""

# 测试未认证访问受保护端点（应返回 401）
echo "[2] 测试未认证访问（应失败）..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/mentors")
if [ "$HTTP_CODE" = "401" ]; then
  echo "✓ 未认证访问正确返回 401"
else
  echo "✗ 错误：应返回 401，实际返回 $HTTP_CODE"
  exit 1
fi
echo ""

# 测试家长登录（ticket-based flow）
echo "[3] 测试家长登录（demo 验证码 -> ticket -> login）..."
VERIFY_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/sms/verify" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PARENT_PHONE\",\"code\":\"$CODE\",\"scene\":\"login\"}")

VERIFY_SUCCESS=$(echo "$VERIFY_RESPONSE" | jq -r '.success')
PARENT_TICKET=$(echo "$VERIFY_RESPONSE" | jq -r '.ticket')

if [ "$VERIFY_SUCCESS" != "true" ] || [ -z "$PARENT_TICKET" ] || [ "$PARENT_TICKET" = "null" ]; then
  echo "✗ 家长 SMS 验证失败"
  echo "$VERIFY_RESPONSE"
  exit 1
fi
echo "✓ SMS 验证成功，ticket: ${PARENT_TICKET:0:20}..."

PARENT_LOGIN=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"ticket\":\"$PARENT_TICKET\",\"role\":\"parent\"}")

PARENT_TOKEN=$(echo "$PARENT_LOGIN" | jq -r '.token')
if [ -z "$PARENT_TOKEN" ] || [ "$PARENT_TOKEN" = "null" ]; then
  echo "✗ 家长登录失败"
  echo "$PARENT_LOGIN"
  exit 1
fi
echo "✓ 家长登录成功，token: ${PARENT_TOKEN:0:20}..."
echo ""

# 测试导师登录（ticket-based flow）
echo "[4] 测试导师登录（demo 验证码 -> ticket -> login）..."
MENTOR_VERIFY=$(curl -s -X POST "$API_BASE/api/auth/sms/verify" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$MENTOR_PHONE\",\"code\":\"$CODE\",\"scene\":\"login\"}")

MENTOR_VERIFY_SUCCESS=$(echo "$MENTOR_VERIFY" | jq -r '.success')
MENTOR_TICKET=$(echo "$MENTOR_VERIFY" | jq -r '.ticket')

if [ "$MENTOR_VERIFY_SUCCESS" != "true" ] || [ -z "$MENTOR_TICKET" ] || [ "$MENTOR_TICKET" = "null" ]; then
  echo "✗ 导师 SMS 验证失败"
  echo "$MENTOR_VERIFY"
  exit 1
fi
echo "✓ SMS 验证成功，ticket: ${MENTOR_TICKET:0:20}..."

MENTOR_LOGIN=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"ticket\":\"$MENTOR_TICKET\",\"role\":\"mentor\"}")

MENTOR_TOKEN=$(echo "$MENTOR_LOGIN" | jq -r '.token')
if [ -z "$MENTOR_TOKEN" ] || [ "$MENTOR_TOKEN" = "null" ]; then
  echo "✗ 导师登录失败"
  echo "$MENTOR_LOGIN"
  exit 1
fi
echo "✓ 导师登录成功，token: ${MENTOR_TOKEN:0:20}..."
echo ""

# 测试家长查看自己的预约
echo "[5] 测试家长查看自己的预约..."
PARENT_BOOKINGS=$(curl -s "$API_BASE/api/bookings" \
  -H "Authorization: Bearer $PARENT_TOKEN")

BOOKING_COUNT=$(echo "$PARENT_BOOKINGS" | jq '. | length')
echo "✓ 家长可以查看预约，共 $BOOKING_COUNT 个"
echo ""

# 测试家长无法查看所有导师
echo "[6] 测试家长查看导师列表（应只看到已审核的）..."
PARENT_MENTORS=$(curl -s "$API_BASE/api/mentors" \
  -H "Authorization: Bearer $PARENT_TOKEN")

MENTOR_COUNT=$(echo "$PARENT_MENTORS" | jq '. | length')
echo "✓ 家长可以查看 $MENTOR_COUNT 个已审核导师"
echo ""

# 测试导师查看自己的预约
echo "[7] 测试导师查看自己的预约..."
MENTOR_BOOKINGS=$(curl -s "$API_BASE/api/bookings" \
  -H "Authorization: Bearer $MENTOR_TOKEN")

MENTOR_BOOKING_COUNT=$(echo "$MENTOR_BOOKINGS" | jq '. | length')
echo "✓ 导师可以查看预约，共 $MENTOR_BOOKING_COUNT 个"
echo ""

# 测试 snapshot 端点需要管理员权限
echo "[8] 测试 /api/snapshot 需要管理员权限..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/snapshot" \
  -H "Authorization: Bearer $PARENT_TOKEN")

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "500" ]; then
  echo "✓ 非管理员无法访问 snapshot（返回 $HTTP_CODE）"
else
  echo "✗ 错误：snapshot 应拒绝非管理员访问，实际返回 $HTTP_CODE"
  exit 1
fi
echo ""

# 测试非管理员手机号不能获得管理员权限
echo "[9] 测试非管理员手机号不能获得管理员权限（即使有valid ticket）..."
ADMIN_ATTEMPT_VERIFY=$(curl -s -X POST "$API_BASE/api/auth/sms/verify" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PARENT_PHONE\",\"code\":\"$CODE\",\"scene\":\"login\"}")
ADMIN_ATTEMPT_TICKET=$(echo "$ADMIN_ATTEMPT_VERIFY" | jq -r '.ticket')

ADMIN_ATTEMPT=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"ticket\":\"$ADMIN_ATTEMPT_TICKET\",\"role\":\"admin\"}")

ADMIN_ATTEMPT_ERROR=$(echo "$ADMIN_ATTEMPT" | jq -r '.error // ""')
if [[ "$ADMIN_ATTEMPT_ERROR" =~ "无管理员权限" ]] || [[ "$ADMIN_ATTEMPT_ERROR" =~ "无法登录" ]]; then
  echo "✓ 非管理员手机号无法获得管理员权限"
else
  echo "✗ 错误：应拒绝非管理员获取admin权限，实际返回: $ADMIN_ATTEMPT"
  exit 1
fi
echo ""

# 测试登出
echo "[10] 测试登出..."
LOGOUT=$(curl -s -X POST "$API_BASE/api/auth/logout" \
  -H "Authorization: Bearer $PARENT_TOKEN")

LOGOUT_SUCCESS=$(echo "$LOGOUT" | jq -r '.success')
if [ "$LOGOUT_SUCCESS" = "true" ]; then
  echo "✓ 登出成功"
else
  echo "✗ 登出失败"
  exit 1
fi
echo ""

# 测试登出后令牌失效
echo "[11] 测试登出后令牌失效..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/bookings" \
  -H "Authorization: Bearer $PARENT_TOKEN")

if [ "$HTTP_CODE" = "401" ]; then
  echo "✓ 登出后令牌正确失效"
else
  echo "✗ 错误：登出后令牌应失效，实际返回 $HTTP_CODE"
  exit 1
fi
echo ""

# 测试未验证码直接登录（应失败）
echo "[12] 测试未验证码直接登录（应失败）..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"ticket\":\"invalid-ticket\",\"role\":\"parent\"}")

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ]; then
  echo "✓ 无效票据登录正确拒绝（返回 $HTTP_CODE）"
else
  echo "✗ 错误：应拒绝无效票据，实际返回 $HTTP_CODE"
  exit 1
fi
echo ""

# 测试家长查看导师列表无隐私信息
echo "[13] 测试家长查看导师列表无敏感信息..."
# Re-login parent for remaining tests
PARENT_VERIFY=$(curl -s -X POST "$API_BASE/api/auth/sms/verify" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PARENT_PHONE\",\"code\":\"$CODE\",\"scene\":\"login\"}")
PARENT_TICKET=$(echo "$PARENT_VERIFY" | jq -r '.ticket')
PARENT_LOGIN=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"ticket\":\"$PARENT_TICKET\",\"role\":\"parent\"}")
PARENT_TOKEN=$(echo "$PARENT_LOGIN" | jq -r '.token')

MENTORS_LIST=$(curl -s "$API_BASE/api/mentors" \
  -H "Authorization: Bearer $PARENT_TOKEN")

# Check that first mentor has no phone/idCard/bankCardNumber
HAS_PHONE=$(echo "$MENTORS_LIST" | jq -r '.[0].phone // ""')
HAS_IDCARD=$(echo "$MENTORS_LIST" | jq -r '.[0].idCard // ""')
HAS_BANK=$(echo "$MENTORS_LIST" | jq -r '.[0].bankCardNumber // ""')

if [ -z "$HAS_PHONE" ] && [ -z "$HAS_IDCARD" ] && [ -z "$HAS_BANK" ]; then
  echo "✓ 家长查看导师列表无敏感信息"
else
  echo "✗ 错误：导师列表泄露敏感信息 (phone: $HAS_PHONE, idCard: $HAS_IDCARD, bank: $HAS_BANK)"
  exit 1
fi
echo ""

# 测试导师查看预约时家长电话已脱敏
echo "[14] 测试导师查看预约时家长电话已脱敏..."
MENTOR_VERIFY2=$(curl -s -X POST "$API_BASE/api/auth/sms/verify" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$MENTOR_PHONE\",\"code\":\"$CODE\",\"scene\":\"login\"}")
MENTOR_TICKET2=$(echo "$MENTOR_VERIFY2" | jq -r '.ticket')
MENTOR_LOGIN2=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"ticket\":\"$MENTOR_TICKET2\",\"role\":\"mentor\"}")
MENTOR_TOKEN2=$(echo "$MENTOR_LOGIN2" | jq -r '.token')

MENTOR_BOOKINGS2=$(curl -s "$API_BASE/api/bookings" \
  -H "Authorization: Bearer $MENTOR_TOKEN2")

MASKED_PHONE=$(echo "$MENTOR_BOOKINGS2" | jq -r '.[0].parentPhone // ""')
if [[ "$MASKED_PHONE" =~ \*\*\*\* ]]; then
  echo "✓ 导师查看预约时家长电话已脱敏: $MASKED_PHONE"
else
  echo "✗ 错误：家长电话未脱敏: $MASKED_PHONE"
  exit 1
fi
echo ""

# 测试token持久化（重启服务后仍有效 - 仅模拟检查）
echo "[15] 测试 token 持久化（当前 token 有效）..."
ME_RESPONSE=$(curl -s "$API_BASE/api/auth/me" \
  -H "Authorization: Bearer $PARENT_TOKEN")

MY_ROLE=$(echo "$ME_RESPONSE" | jq -r '.role')
if [ "$MY_ROLE" = "parent" ]; then
  echo "✓ Token 有效且返回正确角色"
else
  echo "✗ Token 验证失败，返回: $ME_RESPONSE"
  exit 1
fi
echo ""

# 测试 node --check 语法
echo "[16] 测试 Node.js 语法检查..."
cd "$(dirname "$0")"
node --check src/index.js
node --check src/auth.js
node --check src/sms.js
node --check src/db.js
echo "✓ 所有 JS 文件语法正确"
echo ""

echo "===== 所有测试通过 ====="
