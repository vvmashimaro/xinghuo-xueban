/**
 * 星火伴学 · Tailwind CDN 扩展（Style C）
 * 在各页面 tailwind CDN 之后引入，并执行：tailwind.config = window.XH_TAILWIND_CONFIG;
 */
window.XH_TAILWIND_CONFIG = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF8F0',
          100: '#FFE4D6',
          200: '#FFC14D',
          300: '#FF8A3D',
          400: '#FF5A2D',
          500: '#FF5A2D',
          600: '#E83A1F',
          700: '#C42E15',
          800: '#9A2410',
          900: '#7A1D0D',
          blush: '#FFC0CB',
          lavender: '#EDE4FF',
        },
        xh: {
          success: '#4ADE80',
          warning: '#FACC15',
          error: '#FDA4AF',
          info: '#C4B5FD',
          cream: '#FFF8F0',
        },
      },
      boxShadow: {
        bubble: '0 8px 28px -6px rgba(255, 90, 45, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.06)',
      },
    },
  },
};
