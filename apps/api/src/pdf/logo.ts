// Placeholder Zoppi wordmark used in generated PDFs/headers until the real
// logo asset (from "Zoppi Segurança — Design System.dc.html") is supplied and
// dropped into apps/web/public + here as a base64 data URL.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60" viewBox="0 0 240 60">
  <rect width="240" height="60" rx="4" fill="#151F5C" />
  <text x="20" y="40" font-family="Arial, sans-serif" font-weight="800" font-size="28" fill="#FFFFFF" letter-spacing="1">ZOPPI</text>
  <rect x="176" y="18" width="46" height="24" rx="4" fill="#E86020" />
</svg>`.trim();

export const ZOPPI_LOGO_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
