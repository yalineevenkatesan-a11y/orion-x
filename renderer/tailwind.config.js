/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#020204', // Absolute Deep Space Obsidian
          900: '#06060A', // Deep Obsidian base
          850: '#0C0C14', // Lighter Obsidian background
          800: '#121220', // Obsidian card/panel
          700: '#1D1D30', // Obsidian border/separator
          600: '#2A2A44', // Active elements
        },
        quantum: {
          500: '#8B5CF6', // Primary Quantum Purple
          400: '#A78BFA', // Light Purple
          600: '#7C3AED', // Deep Purple hover
        },
        cyber: {
          500: '#06B6D4', // Accent Neon Cyber Blue
          400: '#22D3EE', // Light Cyber Blue
          600: '#0891B2', // Deep Cyber Blue hover
        }
      },
      backgroundImage: {
        'space-glow': 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.12) 0%, rgba(6, 182, 212, 0.08) 50%, transparent 100%)',
        'radial-obsidian': 'radial-gradient(circle at top, #0C0C14 0%, #020204 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
      },
      boxShadow: {
        'purple-glow': '0 0 25px rgba(139, 92, 246, 0.15)',
        'blue-glow': '0 0 25px rgba(6, 182, 212, 0.15)',
        'glass-shadow': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backdropBlur: {
        md: '12px',
        lg: '24px',
      }
    },
  },
  plugins: [],
}
