// js/tailwind-config.js
tailwind.config = {
  theme: {
    extend: {
      colors: {
        pool: {
          orange: '#FF7A28', // Primary brand orange (from logo wordmark)
          teal: '#00B88A',   // Secondary brand teal (from logo wordmark)
          blue: '#0091EA',   // Ocean blue (wave and actions)
          bg: '#FAF9F5',     // Soft warm cream canvas
          dark: '#1E293B',   // Deep slate for text and headings
          gray: '#F1F5F9'    // Light surface cards/borders
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      }
    }
  }
};