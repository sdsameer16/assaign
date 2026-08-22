"use client";

import React from "react";

export const CornerRakhiRight: React.FC = () => {
  return (
    <div className="absolute top-[64px] sm:top-[68px] md:top-[72px] right-1 sm:right-3 md:right-5 pointer-events-none z-35 overflow-visible">
      <svg
        className="w-32 h-64 sm:w-40 sm:h-80 md:w-48 md:h-[360px] overflow-visible drop-shadow-2xl"
        viewBox="0 0 180 340"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="img2RightJewel" cx="45%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#FF80AB" />
            <stop offset="35%" stopColor="#F50057" />
            <stop offset="75%" stopColor="#C51162" />
            <stop offset="100%" stopColor="#880E4F" />
          </radialGradient>
          <radialGradient id="img2RightGoldBead" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFF9C4" />
            <stop offset="40%" stopColor="#FFD54F" />
            <stop offset="85%" stopColor="#FF8F00" />
            <stop offset="100%" stopColor="#E65100" />
          </radialGradient>
          <radialGradient id="img2RightPearlBead" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#FFF9C4" />
            <stop offset="85%" stopColor="#F5F5F5" />
            <stop offset="100%" stopColor="#E0E0E0" />
          </radialGradient>
          <linearGradient id="img2RightMangoLeaf" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#66BB6A" />
            <stop offset="60%" stopColor="#2E7D32" />
            <stop offset="100%" stopColor="#1B5E20" />
          </linearGradient>
          <linearGradient id="img2RightRedThread" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#D32F2F" />
            <stop offset="100%" stopColor="#B71C1C" />
          </linearGradient>
          <linearGradient id="img2RightOrangeThread" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#FF9800" />
            <stop offset="100%" stopColor="#E65100" />
          </linearGradient>
          <filter id="img2RightGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#FF6F00" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* 1. GREEN MANGO LEAF SPRIGS TUCKED BEHIND RAKHI DISC */}
        <g transform="translate(110, 70)">
          <path d="M 0,0 C 25,-20 40,-10 55,0 C 35,15 15,10 0,0 Z" fill="url(#img2RightMangoLeaf)" />
          <path d="M 0,0 C 35,15 45,35 40,55 C 20,40 10,20 0,0 Z" fill="url(#img2RightMangoLeaf)" />
          <path d="M 0,0 C -15,35 -35,45 -55,40 C -40,20 -20,10 0,0 Z" fill="url(#img2RightMangoLeaf)" />
        </g>

        {/* 2. ORNATE RAKHI DISC (EXACT DESIGN FROM IMAGE 2) */}
        <g transform="translate(110, 70)" filter="url(#img2RightGlow)">
          <circle cx="0" cy="0" r="48" fill="none" stroke="#FFD54F" strokeWidth="3" strokeDasharray="6 3" />
          <circle cx="0" cy="0" r="44" fill="#B71C1C" />

          {/* Outer Ring of 16 Pearl Beads */}
          {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5].map((deg) => (
            <circle
              key={deg}
              cx={40 * Math.cos((deg * Math.PI) / 180)}
              cy={40 * Math.sin((deg * Math.PI) / 180)}
              r="3.5"
              fill="url(#img2RightPearlBead)"
            />
          ))}

          {/* Inner Golden Starburst Ring */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <g key={deg} transform={`rotate(${deg})`}>
              <path d="M 0,-34 C -5,-41 0,-45 0,-45 C 0,-45 5,-41 0,-34 Z" fill="url(#img2RightGoldBead)" />
              <circle cx="0" cy="-30" r="2.5" fill="url(#img2RightPearlBead)" />
            </g>
          ))}

          {/* Inner Crimson Floral Petal Ring */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <path
              key={deg}
              d="M 0,0 C -12,-22 0,-30 0,-30 C 0,-30 12,-22 0,0 Z"
              fill="#FFB300"
              transform={`rotate(${deg})`}
            />
          ))}

          {/* Inner Pearl Circle Ring */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <circle
              key={deg}
              cx={18 * Math.cos((deg * Math.PI) / 180)}
              cy={18 * Math.sin((deg * Math.PI) / 180)}
              r="2.5"
              fill="url(#img2RightPearlBead)"
            />
          ))}

          {/* Central Glowing Ruby/Pink Gemstone */}
          <circle cx="0" cy="0" r="14" fill="url(#img2RightJewel)" className="rakhi-jewel-pulse" />
          <circle cx="-3" cy="-4" r="3.2" fill="#FFFFFF" opacity="0.8" />
          <circle cx="0" cy="0" r="14" stroke="#FFD700" strokeWidth="1.5" fill="none" />
        </g>

        {/* 3. LONG VERTICAL HANGING TASSELS (COMPLETELY VISIBLE - NO CLIPPING) */}
        {/* Left String: Orange Tassel */}
        <g transform="translate(85, 118)" className="rakhi-tassel-sway" style={{ animationDelay: "0.4s" }}>
          <line x1="0" y1="0" x2="0" y2="160" stroke="url(#img2RightOrangeThread)" strokeWidth="2" strokeDasharray="4 2" />
          <circle cx="0" cy="25" r="3.5" fill="url(#img2RightPearlBead)" />
          <circle cx="0" cy="50" r="4.5" fill="url(#img2RightGoldBead)" />
          <circle cx="0" cy="78" r="4" fill="#E65100" />
          <circle cx="0" cy="105" r="3.5" fill="url(#img2RightPearlBead)" />
          <circle cx="0" cy="132" r="4.5" fill="url(#img2RightGoldBead)" />
          <circle cx="0" cy="155" r="5" fill="#FF8F00" />

          {/* Fluffy Orange Tassel Tip */}
          <path d="M -7,160 L 7,160 L 9,195 L -9,195 Z" fill="#E65100" />
          <path d="M -9,195 L -11,215 L -6,215 Z" fill="#FF6F00" />
          <path d="M -5,195 L -3,218 L 1,218 Z" fill="#FF8F00" />
          <path d="M 0,195 L 3,218 L 6,218 Z" fill="#FFAB00" />
          <path d="M 5,195 L 9,215 L 11,215 Z" fill="#E65100" />
          <rect x="-7" y="162" width="14" height="4" fill="#FFD700" rx="1" />
        </g>

        {/* Right String: Red Tassel */}
        <g transform="translate(135, 118)" className="rakhi-tassel-sway">
          <line x1="0" y1="0" x2="0" y2="140" stroke="url(#img2RightRedThread)" strokeWidth="2" strokeDasharray="4 2" />
          <circle cx="0" cy="20" r="3.5" fill="url(#img2RightGoldBead)" />
          <circle cx="0" cy="40" r="4" fill="url(#img2RightPearlBead)" />
          <circle cx="0" cy="65" r="4.5" fill="#D32F2F" />
          <circle cx="0" cy="90" r="3.5" fill="url(#img2RightGoldBead)" />
          <circle cx="0" cy="115" r="4" fill="url(#img2RightPearlBead)" />
          <circle cx="0" cy="135" r="5" fill="#B71C1C" />

          {/* Fluffy Red Tassel Tip */}
          <path d="M -7,140 L 7,140 L 9,175 L -9,175 Z" fill="#D32F2F" />
          <path d="M -9,175 L -11,195 L -6,195 Z" fill="#C2185B" />
          <path d="M -5,175 L -3,198 L 1,198 Z" fill="#D32F2F" />
          <path d="M 0,175 L 3,198 L 6,198 Z" fill="#FF1744" />
          <path d="M 5,175 L 9,195 L 11,195 Z" fill="#B71C1C" />
          <rect x="-7" y="142" width="14" height="4" fill="#FFD700" rx="1" />
        </g>
      </svg>
    </div>
  );
};
