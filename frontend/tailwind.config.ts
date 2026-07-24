import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        line: 'var(--border)',
        fg: 'var(--text)',
        muted: 'var(--text-muted)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          quiet: 'var(--accent-quiet)',
        },
        success: { DEFAULT: 'var(--success)', quiet: 'var(--success-q)' },
        warning: { DEFAULT: 'var(--warning)', quiet: 'var(--warning-q)' },
        danger: { DEFAULT: 'var(--danger)', quiet: 'var(--danger-q)' },
        info: { DEFAULT: 'var(--info)', quiet: 'var(--info-q)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '5': '5px',
        '6': '6px',
        '7': '7px',
        '8': '8px',
        '9': '9px',
        '10': '10px',
        '11': '11px',
        '12': '12px',
        '14': '14px',
        '20': '20px',
      },
      backgroundImage: {
        logo: 'linear-gradient(135deg, var(--accent), #a78bfa)',
      },
      boxShadow: {
        menu: '0 16px 40px rgba(0, 0, 0, .4)',
        'menu-sm': '0 14px 34px rgba(0, 0, 0, .4)',
        modal: '0 24px 60px rgba(0, 0, 0, .5)',
        drawer: '0 0 48px rgba(0, 0, 0, .55)',
        toast: '0 12px 30px rgba(0, 0, 0, .4)',
        auth: '0 1px 0 rgba(255, 255, 255, .03) inset, 0 24px 60px -18px rgba(0, 0, 0, .55), 0 8px 24px -12px rgba(0, 0, 0, .4)',
      },
      keyframes: {
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        slide: {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        toast: {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        fade: 'fade .12s ease',
        'fade-slow': 'fade .15s ease',
        slide: 'slide .18s ease',
        toast: 'toast .18s ease',
        'pulse-soft': 'pulseSoft 1.4s infinite',
        shimmer: 'shimmer 1.2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
