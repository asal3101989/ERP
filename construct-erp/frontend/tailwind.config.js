// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary accent — keep blue
        primary: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        // Brand (amber) kept for badges/accents
        brand: {
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'card':  '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
        'modal': '0 20px 60px rgba(15,23,42,0.15), 0 4px 16px rgba(15,23,42,0.1)',
        'glow':  '0 0 20px rgba(37,99,235,0.12)',
      },
      animation: {
        'fade-in':  'fadeIn 0.15s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideIn: { from: { opacity: 0, transform: 'translateY(-4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  safelist: [
    'bg-white/3', 'bg-white/5', 'bg-white/10',
    'hover:bg-white/3', 'hover:bg-white/5',
    'border-white/5', 'border-white/10',
    'badge', 'badge-green', 'badge-yellow', 'badge-amber', 'badge-red',
    'badge-blue', 'badge-purple', 'badge-teal', 'badge-gray', 'badge-indigo', 'badge-orange',
    'btn-primary', 'btn-secondary', 'btn-ghost', 'btn-danger', 'btn-success',
    'card', 'card-lg', 'input', 'input-field', 'label',
    'tabs-bar', 'tab-btn',
    'modal-overlay', 'modal-panel', 'modal-header', 'modal-body', 'modal-footer',
    'progress-track', 'progress-fill', 'progress-blue', 'progress-green', 'progress-amber', 'progress-red',
    'sidebar-item', 'sidebar-group-label',
    'topbar-search', 'metric-card', 'skeleton',
  ],
  plugins: [],
};
