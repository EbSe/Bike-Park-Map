// Inline SVG icons (24x24, currentColor, stroke-based).
// Modern minimalist line-icon set; works on iOS Safari, scales sharply
// at every DPI, takes any color via currentColor.

const stroke = (path, opts = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${opts.fill || 'none'}" stroke="currentColor" stroke-width="${opts.sw || 1.6}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const icons = {
  map: stroke(`
    <path d="M3 6.5l6-2 6 2 6-2v15l-6 2-6-2-6 2v-15z"/>
    <line x1="9" y1="4.5" x2="9" y2="19.5"/>
    <line x1="15" y1="6.5" x2="15" y2="21.5"/>
  `),
  list: stroke(`
    <line x1="8" y1="6" x2="20" y2="6"/>
    <line x1="8" y1="12" x2="20" y2="12"/>
    <line x1="8" y1="18" x2="20" y2="18"/>
    <circle cx="4" cy="6" r="1.5"/>
    <circle cx="4" cy="12" r="1.5"/>
    <circle cx="4" cy="18" r="1.5"/>
  `),
  star: stroke(`<path d="M12 2.5l2.9 6.5 7.1.8-5.3 4.9 1.5 7.1L12 18l-6.2 3.8 1.5-7.1L2 9.8l7.1-.8L12 2.5z"/>`),
  starFilled: stroke(`<path d="M12 2.5l2.9 6.5 7.1.8-5.3 4.9 1.5 7.1L12 18l-6.2 3.8 1.5-7.1L2 9.8l7.1-.8L12 2.5z" fill="currentColor"/>`, { fill: 'currentColor' }),
  stats: stroke(`
    <rect x="3" y="13" width="4" height="8" rx="1"/>
    <rect x="10" y="8" width="4" height="13" rx="1"/>
    <rect x="17" y="4" width="4" height="17" rx="1"/>
  `),
  settings: stroke(`
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.85l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.85-.34 1.7 1.7 0 0 0-1.04 1.55V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.85.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.85 1.7 1.7 0 0 0-1.55-1.04H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.85l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.85.34H9.1a1.7 1.7 0 0 0 1.04-1.55V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.85-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.85V9.1a1.7 1.7 0 0 0 1.55 1.04H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1.04z"/>
  `),
  search: stroke(`
    <circle cx="11" cy="11" r="7"/>
    <line x1="20.5" y1="20.5" x2="16.5" y2="16.5"/>
  `),
  location: stroke(`
    <circle cx="12" cy="12" r="3.5"/>
    <line x1="12" y1="2" x2="12" y2="5"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="5" y2="12"/>
    <line x1="19" y1="12" x2="22" y2="12"/>
  `),
  layers: stroke(`
    <path d="M12 3l9 5-9 5-9-5 9-5z"/>
    <path d="M3 13l9 5 9-5"/>
  `),
  filter: stroke(`<path d="M4 5h16l-6 8v6l-4-2v-4l-6-8z"/>`),
  back: stroke(`<polyline points="14 6 8 12 14 18"/>`, { sw: 2 }),
  close: stroke(`<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>`),
  check: stroke(`<polyline points="4 12 10 18 20 6"/>`, { sw: 2 }),
  plus: stroke(`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`),
  arrow: stroke(`<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>`),
  chevron: stroke(`<polyline points="9 6 15 12 9 18"/>`),
  navigate: stroke(`<polygon points="3 11 22 2 13 21 11 13 3 11"/>`),
  globe: stroke(`
    <circle cx="12" cy="12" r="9"/>
    <ellipse cx="12" cy="12" rx="4" ry="9"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
  `),
  bike: stroke(`
    <circle cx="6" cy="17" r="3.5"/>
    <circle cx="18" cy="17" r="3.5"/>
    <polyline points="6 17 10 11 13 11 17 17"/>
    <line x1="10" y1="11" x2="13" y2="6"/>
    <circle cx="14" cy="5" r="1.2" fill="currentColor"/>
  `),
  mountain: stroke(`
    <polyline points="3 19 9 9 13 15 15 12 21 19"/>
    <line x1="3" y1="19" x2="21" y2="19"/>
  `),
  lift: stroke(`
    <line x1="3" y1="6" x2="21" y2="14"/>
    <rect x="6" y="9" width="4" height="6" rx="0.6"/>
    <rect x="14" y="14" width="4" height="6" rx="0.6"/>
  `),
  route: stroke(`<polyline points="4 10 9 5 9 19 14 14 20 17"/>`),
  ticket: stroke(`
    <rect x="3" y="7" width="18" height="10" rx="2"/>
    <line x1="11" y1="7" x2="11" y2="17" stroke-dasharray="2 2"/>
  `),
  camera: stroke(`
    <rect x="3" y="7" width="18" height="13" rx="2"/>
    <path d="M9 7l1.5-3h3l1.5 3"/>
    <circle cx="12" cy="14" r="3.5"/>
  `),
  refresh: stroke(`
    <path d="M4 12a8 8 0 0 1 13.5-5.5L20 9"/>
    <polyline points="20 4 20 9 15 9"/>
    <path d="M20 12a8 8 0 0 1-13.5 5.5L4 15"/>
    <polyline points="4 20 4 15 9 15"/>
  `),
  download: stroke(`
    <path d="M12 4v11"/>
    <polyline points="7 11 12 16 17 11"/>
    <line x1="4" y1="20" x2="20" y2="20"/>
  `),
  upload: stroke(`
    <path d="M12 20v-11"/>
    <polyline points="7 13 12 8 17 13"/>
    <line x1="4" y1="4" x2="20" y2="4"/>
  `),
  trash: stroke(`
    <polyline points="4 7 20 7"/>
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/>
    <path d="M9 7V4h6v3"/>
  `),
  report: stroke(`
    <path d="M4 4v17"/>
    <path d="M4 4h13l-2 4 2 4H4"/>
  `),
  cloud: stroke(`
    <path d="M7 18a5 5 0 0 1 1-9.9 6 6 0 0 1 11 2.4A4 4 0 0 1 17 18H7z"/>
  `),
  weather: stroke(`
    <circle cx="12" cy="9" r="3"/>
    <path d="M6 17a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1.5"/>
    <path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/>
  `),
  pin: stroke(`
    <path d="M12 2.5C8.1 2.5 5 5.5 5 9.3c0 4.9 7 12.2 7 12.2s7-7.3 7-12.2c0-3.8-3.1-6.8-7-6.8z"/>
    <circle cx="12" cy="9.3" r="2.5"/>
  `),
};

// Convenience function for inline rendering in template literals
export function icon(name, size = 22, opts = {}) {
  const svg = icons[name] || icons.pin;
  return `<span class="icon ${opts.class || ''}" style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center">${svg}</span>`;
}
