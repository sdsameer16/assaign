"use client";

import React from "react";

/**
 * Ultra-Realistic Marigold Flower Pom-Pom Bloom Component (SVG)
 * Recreates the exact fluffy 3D marigold bloom texture shown in the user's reference image.
 */
const MarigoldBloom: React.FC<{ cx: number; cy: number; scale?: number; colorType?: "orange" | "yellow" | "deepOrange" }> = ({
  cx,
  cy,
  scale = 1,
  colorType = "orange",
}) => {
  // Color palette definitions for realistic 3D marigold blooms
  const outerColor = colorType === "yellow" ? "#FBC02D" : colorType === "deepOrange" ? "#E65100" : "#FB8C00";
  const midColor = colorType === "yellow" ? "#FFEB3B" : colorType === "deepOrange" ? "#FB8C00" : "#FFA726";
  const innerColor = colorType === "yellow" ? "#FFF59D" : colorType === "deepOrange" ? "#FFB74D" : "#FFE082";
  const coreColor = colorType === "yellow" ? "#F57F17" : "#D32F2F";

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`} filter="url(#marigold3DShadow)">
      {/* Stem / Calyx base attachment */}
      <path d="M -3,6 Q 0,12 3,6 Z" fill="#2E7D32" />

      {/* Layer 1: Outer Ruffled Petals (16 crinkled petal lobes) */}
      {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5].map((deg) => (
        <path
          key={`l1-${deg}`}
          d="M 0,0 C -5,-14 -12,-16 -7,-20 C -2,-24 2,-24 7,-20 C 12,-16 5,-14 0,0 Z"
          fill={outerColor}
          transform={`rotate(${deg})`}
          opacity="0.95"
        />
      ))}

      {/* Layer 2: Middle Dense Petal Ring (14 offset ruffled petals) */}
      {[11.25, 36.9, 62.5, 88.2, 113.8, 139.5, 165.2, 190.8, 216.5, 242.2, 267.8, 293.5, 319.2, 344.8].map((deg) => (
        <path
          key={`l2-${deg}`}
          d="M 0,0 C -4,-11 -9,-13 -5,-16 C -1,-19 1,-19 5,-16 C 9,-13 4,-11 0,0 Z"
          fill={midColor}
          transform={`rotate(${deg})`}
        />
      ))}

      {/* Layer 3: Inner Pom-Pom Petal Ring (12 compact crinkled petals) */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
        <path
          key={`l3-${deg}`}
          d="M 0,0 C -3,-8 -7,-9 -4,-12 C -1,-14 1,-14 4,-12 C 7,-9 3,-8 0,0 Z"
          fill={innerColor}
          transform={`rotate(${deg})`}
        />
      ))}

      {/* Layer 4: Tight Center Fluffy Core (8 micro-petals + center tuft) */}
      {[15, 60, 105, 150, 195, 240, 285, 330].map((deg) => (
        <circle
          key={`l4-${deg}`}
          cx={3.5 * Math.cos((deg * Math.PI) / 180)}
          cy={3.5 * Math.sin((deg * Math.PI) / 180)}
          r="3"
          fill={coreColor}
        />
      ))}
      <circle cx="0" cy="0" r="3.2" fill="#E65100" />
      <circle cx="-1" cy="-1" r="1.2" fill="#FFFDE7" opacity="0.7" />
    </g>
  );
};

export const MarigoldGarland: React.FC = () => {
  // Generate a continuous dense sequence of overlapping 3D marigold pom-pom blooms from x = 0 to 1200
  const getCatenaryY = (x: number) => {
    const swagWidth = 300;
    const localX = x % swagWidth;
    const normalized = (localX - swagWidth / 2) / (swagWidth / 2);
    return 15 + (1 - normalized * normalized) * 45;
  };

  const flowerPositions: Array<{ x: number; y: number; colorType: "orange" | "yellow" | "deepOrange"; scale: number }> = [];
  // Spacing = 14px to guarantee lush 3D flower overlap matching the user's reference image
  for (let x = -10; x <= 1210; x += 14) {
    const y = getCatenaryY(x < 0 ? 0 : x > 1200 ? 1200 : x);
    const mod = Math.floor((x + 10) / 14) % 3;
    const colorType: "orange" | "yellow" | "deepOrange" = mod === 0 ? "orange" : mod === 1 ? "deepOrange" : "yellow";
    const scale = 0.95 + Math.sin(x * 0.08) * 0.08;
    flowerPositions.push({ x, y, colorType, scale });
  }

  return (
    <div className="absolute top-[64px] sm:top-[68px] md:top-[72px] left-0 right-0 w-full overflow-hidden pointer-events-none z-30 flex justify-center">
      {/* STATIC FULL-WIDTH REALISTIC 3D MARIGOLD GARLAND */}
      <svg
        className="w-full h-20 sm:h-24 md:h-28 max-w-none drop-shadow-md"
        viewBox="0 0 1200 125"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="marigold3DShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.32" />
          </filter>
          <linearGradient id="marigoldStemLeaf" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#66BB6A" />
            <stop offset="60%" stopColor="#2E7D32" />
            <stop offset="100%" stopColor="#1B5E20" />
          </linearGradient>
        </defs>

        {/* 1. SECONDARY GOLDEN BEAD LOOP SAGGING BENEATH THE MARIGOLD GARLAND */}
        <path
          d="M 0,25 Q 150,75 300,30 Q 450,80 600,30 Q 750,80 900,30 Q 1050,75 1200,25"
          stroke="#FFD700"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          fill="none"
        />

        {/* 2. GREEN MANGO LEAF SPRIGS AT SWAG PEAKS & DIPS */}
        {[0, 150, 300, 450, 600, 750, 900, 1050, 1200].map((x, lIdx) => (
          <g key={lIdx} transform={`translate(${x}, ${lIdx % 2 === 0 ? 18 : 58})`} filter="url(#marigold3DShadow)">
            <path d="M 0,0 C -6,14 -10,28 -3,42 C 5,28 3,14 0,0 Z" fill="url(#marigoldStemLeaf)" />
            <path d="M -4,2 C -14,14 -20,26 -13,38 C -4,26 -3,14 -4,2 Z" fill="url(#marigoldStemLeaf)" />
            <path d="M 4,2 C 14,14 20,26 13,38 C 4,26 3,14 4,2 Z" fill="url(#marigoldStemLeaf)" />
          </g>
        ))}

        {/* 3. DENSE CONTINUOUS 3D FLUFFY MARIGOLD POM-POM BLOOMS (NO GAPS, NO EYE SHAPES) */}
        {flowerPositions.map((pos, idx) => (
          <MarigoldBloom key={idx} cx={pos.x} cy={pos.y} scale={pos.scale} colorType={pos.colorType} />
        ))}
      </svg>
    </div>
  );
};
