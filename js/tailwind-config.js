/**
 * 星火学伴 · 共享 Tailwind CDN 配置（方案 A · 自然陪伴）
 * 须在 cdn.tailwindcss.com 之后加载。
 * teal 阶整表覆盖为森林绿 / 鼠尾草，既有 teal-* 工具类随令牌变色。
 */
(function (global) {
  'use strict';
  var forest = {
    50: '#f3f8f1',
    100: '#e7f3e4',
    200: '#d3e7bf',
    300: '#c5e6ae',
    400: '#a6cd72',
    500: '#2f8f6e',
    600: '#166b56',
    700: '#115645',
    800: '#0e4639',
    900: '#173d32',
    950: '#0d2820'
  };
  var cfg = {
    theme: {
      extend: {
        colors: {
          brand: forest,
          teal: forest,
          cream: '#f6f6ee',
          sage: '#dfefca',
          ink: '#173d32',
          wechat: '#07c160',
          danger: {
            DEFAULT: '#e11d48',
            50: '#fff1f2',
            200: '#fecdd3',
            600: '#e11d48',
            700: '#be123c'
          }
        },
        fontFamily: {
          sans: [
            '"PingFang SC"',
            '"Hiragino Sans GB"',
            '"Microsoft YaHei"',
            '"Noto Sans CJK SC"',
            '-apple-system',
            'BlinkMacSystemFont',
            'system-ui',
            'sans-serif'
          ],
          mono: [
            '"JetBrains Mono"',
            'ui-monospace',
            'SFMono-Regular',
            'Menlo',
            'Monaco',
            'Consolas',
            'monospace'
          ]
        },
        borderRadius: {
          card: '20px',
          pill: '999px'
        }
      }
    }
  };
  if (typeof global.tailwind === 'object' && global.tailwind.config) {
    global.tailwind.config = cfg;
  } else {
    global.tailwind = global.tailwind || {};
    global.tailwind.config = cfg;
  }
  global.XH_TAILWIND_CONFIG = cfg;
})(typeof window !== 'undefined' ? window : global);
