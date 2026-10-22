/**
 * 星火学伴 · 共享 Tailwind CDN 配置
 * 须在 cdn.tailwindcss.com 之后加载。
 */
(function (global) {
  'use strict';
  var cfg = {
    theme: {
      extend: {
        colors: {
          brand: {
            50: '#f0fdfa',
            100: '#ccfbf1',
            200: '#99f6e4',
            500: '#14b8a6',
            600: '#0d9488',
            700: '#0f766e',
            800: '#115e59',
            900: '#134e4a'
          },
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
