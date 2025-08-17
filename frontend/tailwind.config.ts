import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy dark theme (preserved for compatibility)
        background: "var(--background)",
        foreground: "var(--foreground)",
        
        // New glassmorphism design system
        'glass-bg': 'var(--bg)',
        'glass-surface': 'rgba(var(--glass), 0.55)',
        'glass-border': 'rgba(255, 255, 255, 0.6)',
        'ink': 'var(--ink)',
        'muted': 'var(--muted)',
        'accent': 'var(--accent)',
        'buy': 'var(--buy)',
        'sell': 'var(--sell)',
        'warning': 'var(--warning)',
      },
      borderRadius: {
        'card': 'var(--radius-card)',
        'field': 'var(--radius-field)',
        'chip': 'var(--radius-chip)',
      },
      boxShadow: {
        'glass-sm': 'var(--shadow-sm)',
        'glass-lg': 'var(--shadow-lg)',
      },
      backdropBlur: {
        'glass': '14px',
      },
      backdropSaturate: {
        'glass': '140%',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['Roboto Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        '12': ['12px', { lineHeight: '16px' }],
        '14': ['14px', { lineHeight: '20px' }],
        '16': ['16px', { lineHeight: '24px' }],
        '20': ['20px', { lineHeight: '28px' }],
        '24': ['24px', { lineHeight: '32px' }],
        '32': ['32px', { lineHeight: '40px' }],
      },
      spacing: {
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '5': '40px',
        '6': '48px',
      },
    },
  },
  plugins: [],
};

export default config;
