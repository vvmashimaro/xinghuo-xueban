#!/usr/bin/env node
'use strict';

/**
 * 微信支付 / 退款状态对账（默认 dry-run，加 --apply 写库）
 *
 * 用法（生产机，在 /www/xinghuo-app/server 下）：
 *   node scripts/reconcile-wechat-pay.js
 *   node scripts/reconcile-wechat-pay.js --apply
 *   node scripts/reconcile-wechat-pay.js --out-trade-no=BK-xxx --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../src/db');
const wechatPay = require('../src/wechat-pay');
const { reconcileWechatPay } = require('../src/pay-reconcile');

function parseArgs(argv) {
  const opts = { apply: false, limit: 50 };
  argv.forEach((arg) => {
    if (arg === '--apply' || arg === '-a') opts.apply = true;
    else if (arg.startsWith('--limit=')) opts.limit = parseInt(arg.split('=')[1], 10) || 50;
    else if (arg.startsWith('--out-trade-no=')) opts.outTradeNo = arg.slice('--out-trade-no='.length);
  });
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  wechatPay.hydrateMockOrders(db.getPayOrders());

  const report = await reconcileWechatPay({ db, wechatPay }, opts);
  console.log(JSON.stringify(report, null, 2));
  if (!opts.apply && report.mismatchCount > 0) {
    console.error('\n(dry-run) 发现差异但未写库；确认后加 --apply 执行同步');
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
