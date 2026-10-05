import React from 'react';

/**
 * Brand artwork for the heritage theme (olive / beige / brown / brass).
 * All vectors are inline so they render crisply at any size with no asset fetch.
 */

export const Crest: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
    {/* Shield */}
    <path
      d="M24 3L7 10.2v13.2C7 33.6 14.4 42.2 24 45c9.6-2.8 17-11.4 17-21.6V10.2L24 3z"
      fill="url(#crestShield)"
      stroke="#96763F"
      strokeWidth="1.4"
    />
    {/* Inner field */}
    <path
      d="M24 6.6L10.4 12.4v11c0 8.1 6 15.2 13.6 17.7 7.6-2.5 13.6-9.6 13.6-17.7v-11L24 6.6z"
      fill="#211A12"
    />
    {/* Laurel sprigs */}
    <g stroke="#B9975B" strokeWidth="1.3" strokeLinecap="round">
      <path d="M17 30c-2.4-2.8-3.4-6.4-3-10" />
      <path d="M31 30c2.4-2.8 3.4-6.4 3-10" />
      {[-8, -5, -2].map((dy, i) => (
        <path key={`l${i}`} d={`M14.6 ${22 + dy}c-1.8-.4-3.2-1.6-4-3.2 2-.4 3.6.2 4.7 1.6`} />
      ))}
      {[-8, -5, -2].map((dy, i) => (
        <path key={`r${i}`} d={`M33.4 ${22 + dy}c1.8-.4 3.2-1.6 4-3.2-2-.4-3.6.2-4.7 1.6`} />
      ))}
    </g>
    {/* Star */}
    <path
      d="M24 13.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L24 23.2l-3.9 2.3.9-4.4-3.3-3 4.4-.5L24 13.5z"
      fill="#D4BC88"
    />
    {/* Wordmark bar */}
    <path d="M17.5 33.5h13" stroke="#77854A" strokeWidth="1.6" strokeLinecap="round" />
    <defs>
      <linearGradient id="crestShield" x1="7" y1="3" x2="41" y2="45" gradientUnits="userSpaceOnUse">
        <stop stopColor="#5F6D3B" />
        <stop offset="0.55" stopColor="#3C4525" />
        <stop offset="1" stopColor="#2E2011" />
      </linearGradient>
    </defs>
  </svg>
);

/** Large olive-branch illustration for the login split panel. */
export const OliveBranch: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 420 520" fill="none" className={className} aria-hidden="true">
    {/* Soft halo */}
    <circle cx="210" cy="240" r="190" fill="url(#halo)" />
    {/* Main stem */}
    <path
      d="M78 470C120 400 150 330 172 250c18-66 30-140 36-212"
      stroke="#77854A"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    {/* Branch leaves — alternating pairs climbing the stem */}
    {[
      { x: 176, y: 226, r: -34, s: 1.05 },
      { x: 196, y: 268, r: 38, s: 0.92 },
      { x: 208, y: 312, r: -30, s: 1.12 },
      { x: 228, y: 356, r: 42, s: 0.88 },
      { x: 244, y: 400, r: -26, s: 1.0 },
      { x: 262, y: 442, r: 44, s: 0.8 },
      { x: 154, y: 262, r: -128, s: 0.82 },
      { x: 138, y: 310, r: 132, s: 0.95 },
      { x: 122, y: 358, r: -124, s: 0.85 },
      { x: 104, y: 406, r: 130, s: 0.92 },
      { x: 86, y: 452, r: -122, s: 0.78 },
    ].map((leaf, i) => (
      <g key={i} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r}) scale(${leaf.s})`}>
        <path
          d="M0 0C16 -10 34 -12 52 -4 38 10 16 12 0 0Z"
          fill={i % 2 === 0 ? '#5F6D3B' : '#77854A'}
          opacity={0.92}
        />
        <path d="M0 0C18 -5 36 -6 52 -4" stroke="#2D341C" strokeWidth="1" opacity="0.35" />
      </g>
    ))}
    {/* Olives */}
    <g>
      <circle cx="150" cy="238" r="11" fill="#3C4525" />
      <circle cx="146.5" cy="234.5" r="3.2" fill="#77854A" opacity="0.7" />
      <circle cx="238" cy="330" r="9.5" fill="#3C4525" />
      <circle cx="235" cy="327" r="2.8" fill="#77854A" opacity="0.7" />
      <circle cx="196" cy="180" r="8.5" fill="#4C572F" />
      <circle cx="193.4" cy="177.4" r="2.5" fill="#93A05C" opacity="0.8" />
    </g>
    {/* Brass arc frame */}
    <path
      d="M60 200a150 150 0 0 1 300 0"
      stroke="#B9975B"
      strokeWidth="1.6"
      strokeDasharray="1 7"
      strokeLinecap="round"
      opacity="0.85"
    />
    <path
      d="M84 210a126 126 0 0 1 252 0"
      stroke="#96763F"
      strokeWidth="1"
      opacity="0.5"
    />
    <defs>
      <radialGradient id="halo" cx="0.5" cy="0.42" r="0.65">
        <stop stopColor="#3B3022" />
        <stop offset="0.7" stopColor="#2E2519" stopOpacity="0.55" />
        <stop offset="1" stopColor="#2E2519" stopOpacity="0" />
      </radialGradient>
    </defs>
  </svg>
);

/** Fine concentric-arc texture used behind hero surfaces. */
export const ArcTexture: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 600 300" fill="none" preserveAspectRatio="none" className={className} aria-hidden="true">
    {[40, 80, 120, 160, 200, 240].map((r, i) => (
      <circle
        key={i}
        cx="300"
        cy="330"
        r={r}
        stroke={i % 2 === 0 ? '#B9975B' : '#77854A'}
        strokeWidth="1"
        opacity={0.28 - i * 0.03}
      />
    ))}
  </svg>
);
