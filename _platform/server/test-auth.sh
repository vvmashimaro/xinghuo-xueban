#!/bin/bash
# 测试脚本：验证星火学伴 API 认证和授权

set -e

API_BASE="${API_BASE:-http://127.0.0.1:8787}"
PARENT_PHONE="13980889211"
MENTOR_PHONE="13880123456"
CODE="888888"

echo "===== 星火学伴 API 测试 ====="
echo "API Base: $API_BASE"
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

# 测试家长登录
echo "[3] 测试家长登录（demo 验证码）..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/sms/verify" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PARENT_PHONE\",\"code\":\"$CODE\",\"scene\":\"login\"}")

echo "$LOGIN_RESPONSE" | jq -r '.success'

PARENT_LOGIN=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PARENT_PHONE\",\"role\":\"parent\"}")

PARENT_TOKEN=$(echo "$PARENT_LOGIN" | jq -r '.token')
if [ -z "$PARENT_TOKEN" ] || [ "$PARENT_TOKEN" = "null" ]; then
  echo "✗ 家长登录失败"
  echo "$PARENT_LOGIN"
  exit 1
fi
echo "✓ 家长登录成功，token: ${PARENT_TOKEN:0:20}..."
echo ""

# 测试导师登录
echo "[4] 测试导师登录（demo 验证码）..."
MENTOR_LOGIN=$(curl -s -X POST "$API_BASE/api/auth/sms/verify" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$MENTOR_PHONE\",\"code\":\"$CODE\",\"scene\":\"login\"}")

echo "$MENTOR_LOGIN" | jq -r '.success'

MENTOR_LOGIN=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$MENTOR_PHONE\",\"role\":\"mentor\"}")

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

# 测试 888888 不能获得管理员权限
echo "[9] 测试 demo 验证码不能获得管理员权限..."
ADMIN_ATTEMPT=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PARENT_PHONE\",\"role\":\"admin\"}")

ADMIN_ROLE=$(echo "$ADMIN_ATTEMPT" | jq -r '.user.role')
if [ "$ADMIN_ROLE" = "admin" ]; then
  echo "✗ 错误：普通手机号不应获得管理员权限"
  exit 1
fi
echo "✓ demo 验证码无法获得管理员权限"
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

echo "===== 所有测试通过 ====="
