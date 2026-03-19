import { SessionDress } from './sessionHistory';

export type RankedDress = {
  dress: SessionDress;
  score: number;
};

type ShareSelectionOptions = {
  shortlistDressIds: string[];
  rankedDresses: RankedDress[];
  limit?: number;
};

type SessionRecapSvgOptions = {
  brideName: string;
  storeName: string;
  dresses: RankedDress[];
};

const DEFAULT_LIMIT = 3;

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function getPrimaryImageUrl(dress: SessionDress) {
  return [...(dress.dress_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.image_url ?? null;
}

function buildDressCardSvg(entry: RankedDress, index: number) {
  const x = [75, 220, 365][index] ?? 75 + index * 120;
  const y = [260, 220, 260][index] ?? 240;
  const rotation = [-11, 0, 11][index] ?? 0;
  const imageUrl = getPrimaryImageUrl(entry.dress);
  const label = truncateLabel(entry.dress.name?.trim() || 'Untitled dress', 24);

  return `
    <g transform="translate(${x} ${y}) rotate(${rotation})">
      <rect x="0" y="0" rx="26" ry="26" width="160" height="260" fill="#FFFFFF" opacity="0.94" />
      <rect x="8" y="8" rx="22" ry="22" width="144" height="244" fill="#FCEFF3" />
      ${
        imageUrl
          ? `<image href="${escapeXml(imageUrl)}" x="16" y="16" width="128" height="182" preserveAspectRatio="xMidYMid slice" />`
          : `<rect x="16" y="16" rx="18" ry="18" width="128" height="182" fill="#F7DDE6" />`
      }
      <rect x="16" y="206" rx="16" ry="16" width="128" height="34" fill="#FFFFFF" opacity="0.92" />
      <text x="80" y="227" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="15" font-weight="700" fill="#8C5162">
        #${index + 1}
      </text>
      <text x="80" y="248" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600" fill="#6A4C56">
        ${escapeXml(label)}
      </text>
    </g>
  `;
}

export function selectShareTopDresses({ shortlistDressIds, rankedDresses, limit = DEFAULT_LIMIT }: ShareSelectionOptions) {
  const shortlistSet = new Set(shortlistDressIds);
  const shortlisted = rankedDresses.filter((entry) => shortlistSet.has(entry.dress.id));
  const fallback = rankedDresses.filter((entry) => !shortlistSet.has(entry.dress.id));

  return [...shortlisted, ...fallback].slice(0, limit);
}

export function buildSessionRecapSvg({ brideName, storeName, dresses }: SessionRecapSvgOptions) {
  const safeBrideName = truncateLabel(brideName.trim() || 'Bride', 28);
  const safeStoreName = truncateLabel(storeName.trim() || 'Bridal Studio', 28);
  const cards = dresses.map((entry, index) => buildDressCardSvg(entry, index)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="900" viewBox="0 0 600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="92" y1="52" x2="530" y2="818" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FDF7FB" />
      <stop offset="0.48" stop-color="#FDEEF5" />
      <stop offset="1" stop-color="#F8DDEB" />
    </linearGradient>
    <radialGradient id="pinkGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 720) rotate(13) scale(230 290)">
      <stop stop-color="#F8C8DB" stop-opacity="0.85" />
      <stop offset="1" stop-color="#F8C8DB" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="lavenderGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(530 690) rotate(147) scale(250 300)">
      <stop stop-color="#E9CFF1" stop-opacity="0.7" />
      <stop offset="1" stop-color="#E9CFF1" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="topGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(132 140) rotate(33) scale(210 210)">
      <stop stop-color="#FADBE7" stop-opacity="0.72" />
      <stop offset="1" stop-color="#FADBE7" stop-opacity="0" />
    </radialGradient>
    <filter id="softShadow" x="20" y="140" width="560" height="580" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset dy="24"/>
      <feGaussianBlur stdDeviation="22"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.770833 0 0 0 0 0.592757 0 0 0 0 0.663767 0 0 0 0.22 0"/>
      <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_84_9"/>
      <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_84_9" result="shape"/>
    </filter>
  </defs>

  <rect width="600" height="900" fill="url(#bg)" />
  <rect width="600" height="900" fill="url(#pinkGlow)" />
  <rect width="600" height="900" fill="url(#lavenderGlow)" />
  <rect width="600" height="900" fill="url(#topGlow)" />

  <g opacity="0.52">
    <circle cx="83" cy="182" r="5" fill="#FFFFFF" />
    <circle cx="524" cy="668" r="6" fill="#FFFFFF" />
    <circle cx="147" cy="745" r="4" fill="#FFFFFF" />
    <circle cx="430" cy="180" r="4" fill="#FFFFFF" />
    <circle cx="317" cy="114" r="3" fill="#FFDCE9" />
    <circle cx="483" cy="788" r="3" fill="#FFDCE9" />
  </g>

  <text x="300" y="108" text-anchor="middle" font-family="Snell Roundhand, Brush Script MT, cursive" font-size="40" font-weight="700" fill="#A45974">
    ${escapeXml(safeStoreName)}
  </text>
  <text x="300" y="156" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#6A4855">
    Session Recap
  </text>
  <text x="300" y="193" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="600" fill="#8A6876">
    ${escapeXml(`${safeBrideName}'s dress fitting`)}
  </text>

  <g filter="url(#softShadow)">
    ${cards}
  </g>

  <text x="300" y="830" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="600" fill="#8C6A77">
    Top picks from today&apos;s fitting session
  </text>
</svg>`;
}
