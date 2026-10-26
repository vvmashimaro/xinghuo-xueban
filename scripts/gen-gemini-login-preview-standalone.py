#!/usr/bin/env python3
"""Regenerate docs/previews/gemini-ui-login-preview-standalone.html (offline file://)."""
from __future__ import annotations

import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    auth_css = (ROOT / "css/auth-login.css").read_text(encoding="utf-8")
    loader_svg = (ROOT / "assets/loading/spark-mascot-loader.svg").read_text(encoding="utf-8")
    png_path = ROOT / "assets/brand/spark-mascot-96-transparent.png"
    if not png_path.exists():
        raise SystemExit("missing transparent mascot PNG")

    loader_uri = "data:image/svg+xml;base64," + base64.b64encode(loader_svg.encode("utf-8")).decode("ascii")
    png_uri = "data:image/png;base64," + base64.b64encode(png_path.read_bytes()).decode("ascii")

    extra = """
html, body { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
:root {
  --brand-primary: #ff6b2c; --brand-primary-hover: #e85a1b; --trust-navy: #1e293b;
  --bg-card: #fff; --text-main: #0f172a; --text-muted: #94a3b8;
  --radius-lg: 16px; --radius-md: 10px;
  --shadow-card: 0 4px 20px -2px rgba(15, 23, 42, 0.06);
  --shadow-float: 0 12px 32px -4px rgba(255, 107, 44, 0.25);
  --focus-ring-brand: 0 0 0 3px rgba(255, 107, 44, 0.15);
  --auth-input-height: 48px; --type-xs: 12px; --type-sm: 14px;
}
.glass-panel { background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(20px); }
.tw { color: #fff; } .tm { color: #94a3b8; } .ts { color: rgba(203,213,225,.85); }
.h1 { font-size: 1.25rem; font-weight: 900; margin: 0; }
.row { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.stack > * + * { margin-top: 1rem; }
.pad-main { padding: 1rem 1.25rem 2rem; }
"""

    html = f"""<!DOCTYPE html>
<html lang="zh-CN" data-xh-auth-ui="1">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>星火学伴 - 极简登录与认证中心</title>
  <style>{extra}{auth_css}</style>
</head>
<body class="xh-auth-page min-h-screen flex flex-col">
  <header class="row pad-main" style="padding-bottom:0">
    <div class="row" style="min-width:0">
      <div class="xh-brand-mark"><img src="{png_uri}" alt="" width="36" height="36"></div>
      <div style="min-width:0">
        <div class="tw" style="font-weight:900;font-size:1rem">星火学伴</div>
        <div class="tm" style="font-size:12px">阳光合规课辅 · 智能共享空间</div>
      </div>
    </div>
    <div id="roleSwitchBar" class="xh-role-pill shrink-0" role="tablist">
      <button type="button" id="tabParent" data-role="parent" aria-selected="true">找学伴</button>
      <button type="button" id="tabMentor" data-role="mentor" aria-selected="false">去授课</button>
    </div>
  </header>
  <main class="flex-1 pad-main">
    <div class="xh-auth-shell">
      <aside id="authHeroParent" class="xh-auth-hero">
        <p class="inline-flex items-center gap-1.5 text-xs font-bold text-orange-200 bg-orange-500/15 border border-orange-400/25 px-3 py-1 rounded-full">阳光合规 · 一课一消托管</p>
        <h2 class="tw" style="font-size:1.65rem;line-height:1.3;font-weight:900">为成都家庭连接<br>可核验的高校学伴</h2>
        <p class="tm" style="font-size:14px;line-height:1.6;max-width:28rem">学信网实名、微网点安全伴学、课时费托管释放——三大机制降低黑家教风险。</p>
        <div class="stack">
          <div class="xh-trust-card"><h3>985/211 学信网核验</h3><p>导师入库前完成学籍与身份一致性核对。</p></div>
          <div class="xh-trust-card"><h3>微网点实体空间伴学</h3><p>合规微空间授课，减少入户安全顾虑。</p></div>
          <div class="xh-trust-card"><h3>课时费银行级托管</h3><p>课次费用预先冻结，完课按规则释放。</p></div>
        </div>
      </aside>
      <aside id="authHeroMentor" class="xh-auth-hero is-hidden" aria-hidden="true">
        <p class="inline-flex items-center gap-1.5 text-xs font-bold text-orange-200 bg-orange-500/15 border border-orange-400/25 px-3 py-1 rounded-full">阳光勤工 · L1/L2 入库认证</p>
        <h2 class="tw" style="font-size:1.65rem;line-height:1.3;font-weight:900">高校学伴接单<br>课酬有保障、履约有记录</h2>
        <p class="tm" style="font-size:14px;line-height:1.6;max-width:28rem">完成资质核验与能力画像后即可入库；约课、打卡、结课与托管释放全程可追溯。</p>
        <div class="stack">
          <div class="xh-trust-card"><h3>L1/L2 合规入库</h3><p>分步核验后生成导师专属码与工作台权限。</p></div>
          <div class="xh-trust-card"><h3>课酬托管 · 一课一结</h3><p>课酬预先冻结，完课打卡后按规则划拨。</p></div>
          <div class="xh-trust-card"><h3>阳光履约留痕</h3><p>接单、排期、结课与课后小结在线可查。</p></div>
        </div>
      </aside>
      <div class="w-full max-w-md mx-auto px-4 lg:px-0 lg:max-w-none">
        <div id="authHeroMobileParent" class="xh-auth-hero-mobile">
          <div class="xh-trust-chip">学信网核验</div><div class="xh-trust-chip">微网点安全伴学</div><div class="xh-trust-chip">课时费托管</div>
        </div>
        <div id="authHeroMobileMentor" class="xh-auth-hero-mobile is-hidden" aria-hidden="true">
          <div class="xh-trust-chip">L1/L2 入库</div><div class="xh-trust-chip">课酬托管</div><div class="xh-trust-chip">履约留痕</div>
        </div>
        <div class="xh-auth-panel glass-panel stack">
          <div>
            <h1 id="roleTitle" class="h1 tw">家长 / 学员登录</h1>
            <p id="roleSubtitle" class="ts" style="font-size:14px;margin:.35rem 0 0">单次约课零预付 · 优选双一流学霸导师</p>
          </div>
          <div class="stack">
            <div><label class="block text-xs font-bold ts" style="margin-bottom:.35rem">手机号码</label><input class="xh-auth-input" type="tel" placeholder="请输入 11 位手机号"></div>
            <div><label class="block text-xs font-bold ts" style="margin-bottom:.35rem">短信验证码</label>
              <div style="position:relative"><input class="xh-auth-input" style="padding-right:7.5rem" placeholder="6 位验证码"><button type="button" class="xh-sms-send">获取验证码</button></div></div>
            <button type="button" id="btnDemo" class="xh-btn-primary row" style="justify-content:center"><span id="btnSubmitLoginText">安全登录并找学伴</span></button>
          </div>
          <div id="registerPromptBox" class="row" style="font-size:12px"><span class="tm">首次约课辅导？</span><span class="xh-auth-link" style="font-weight:700">前往学情建档注册 →</span></div>
        </div>
      </div>
    </div>
  </main>
  <footer class="tm" style="text-align:center;font-size:12px;padding:1rem">© 2026 星火学伴</footer>
  <script>
    const LOADER_SRC = "{loader_uri}";
    function loginCtaLabel(role) {{ return role === 'mentor' ? '登录并进入工作台' : '安全登录并找学伴'; }}
    function switchRole(role) {{
      document.getElementById('tabParent').setAttribute('aria-selected', role === 'parent');
      document.getElementById('tabMentor').setAttribute('aria-selected', role === 'mentor');
      ['authHeroParent','authHeroMobileParent'].forEach(id => document.getElementById(id).classList.toggle('is-hidden', role !== 'parent'));
      ['authHeroMentor','authHeroMobileMentor'].forEach(id => document.getElementById(id).classList.toggle('is-hidden', role !== 'mentor'));
      const reg = document.getElementById('registerPromptBox');
      if (role === 'mentor') {{
        document.getElementById('roleTitle').textContent = '高校学伴 · 导师登录';
        document.getElementById('roleSubtitle').textContent = '完课打卡 · 课酬托管结算 · 阳光透明接单';
        document.getElementById('btnSubmitLoginText').textContent = loginCtaLabel('mentor');
        reg.innerHTML = '<span class="tm">尚未完成入库？</span><span class="xh-auth-link" style="font-weight:700">进入导师认证与建库 (L1/L2) →</span>';
      }} else {{
        document.getElementById('roleTitle').textContent = '家长 / 学员登录';
        document.getElementById('roleSubtitle').textContent = '单次约课零预付 · 优选双一流学霸导师';
        document.getElementById('btnSubmitLoginText').textContent = loginCtaLabel('parent');
        reg.innerHTML = '<span class="tm">首次约课辅导？</span><span class="xh-auth-link" style="font-weight:700">前往学情建档注册 →</span>';
      }}
    }}
    document.getElementById('roleSwitchBar').addEventListener('click', e => {{
      const btn = e.target.closest('button[data-role]');
      if (btn) switchRole(btn.getAttribute('data-role'));
    }});
    document.getElementById('btnDemo').addEventListener('click', function() {{
      const role = document.getElementById('tabMentor').getAttribute('aria-selected') === 'true' ? 'mentor' : 'parent';
      this.innerHTML = '<img src="' + LOADER_SRC + '" alt="" class="xh-inline-mascot-loader" width="24" height="24"><span>验证中...</span>';
      setTimeout(() => {{ this.innerHTML = '<span id="btnSubmitLoginText">' + loginCtaLabel(role) + '</span>'; }}, 1500);
    }});
    switchRole('parent');
  </script>
</body>
</html>
"""
    out_path = ROOT / "docs/previews/gemini-ui-login-preview-standalone.html"
    out_path.write_text(html, encoding="utf-8")
    print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
