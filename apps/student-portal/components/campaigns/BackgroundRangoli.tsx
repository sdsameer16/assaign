"use client";

import React from "react";

export const BackgroundRangoli: React.FC = () => {
  return (
    <div className="absolute top-[64px] sm:top-[68px] md:top-[72px] left-0 right-0 w-full h-[360px] pointer-events-none z-20 overflow-hidden">
      {/* Soft Pale Cream / Warm Golden Amber Ambient Background Gradient (As in Reference Image 2) */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FFFDF8]/95 via-[#FFF6E9]/60 to-transparent dark:from-[#1E140C]/90 dark:via-[#140A02]/40 dark:to-transparent" />

      {/* Traditional Indian Rangoli Line-Art Watermark - Top Left Corner (Matching Image 2) */}
      <svg
        className="absolute -top-6 -left-6 w-80 h-80 sm:w-[420px] sm:h-[420px] text-[#C59B27]/22 dark:text-[#FFD700]/14"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="200" cy="200" r="185" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
        <circle cx="200" cy="200" r="165" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="200" cy="200" r="140" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="200" cy="200" r="100" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="200" cy="200" r="60" stroke="currentColor" strokeWidth="0.8" />

        {/* 24 Radial Rangoli Petal Loops */}
        {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 200 200)`}>
            <path d="M 200,35 C 182,85 200,105 200,105 C 200,105 218,85 200,35 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="200" cy="25" r="2.5" fill="currentColor" />
          </g>
        ))}

        {/* Inner Lotus Petal Starburst */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <path
            key={deg}
            d="M 200,200 C 180,150 200,130 200,130 C 200,130 220,150 200,200 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            transform={`rotate(${deg} 200 200)`}
          />
        ))}
      </svg>

      {/* Traditional Indian Rangoli Line-Art Watermark - Top Right Corner (Matching Image 2) */}
      <svg
        className="absolute -top-6 -right-6 w-80 h-80 sm:w-[420px] sm:h-[420px] text-[#C59B27]/22 dark:text-[#FFD700]/14"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="200" cy="200" r="185" stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
        <circle cx="200" cy="200" r="165" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="200" cy="200" r="140" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="200" cy="200" r="100" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="200" cy="200" r="60" stroke="currentColor" strokeWidth="0.8" />

        {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 200 200)`}>
            <path d="M 200,35 C 182,85 200,105 200,105 C 200,105 218,85 200,35 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="200" cy="25" r="2.5" fill="currentColor" />
          </g>
        ))}

        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <path
            key={deg}
            d="M 200,200 C 180,150 200,130 200,130 C 200,130 220,150 200,200 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            transform={`rotate(${deg} 200 200)`}
          />
        ))}
      </svg>

      {/* Faint Subtle Bottom-Center Rangoli Watermark Outline */}
      <svg
        className="absolute top-28 left-1/2 -translate-x-1/2 w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] text-[#C59B27]/12 dark:text-[#FFD700]/08"
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="250" cy="250" r="220" stroke="currentColor" strokeWidth="0.8" strokeDasharray="6 6" />
        <circle cx="250" cy="250" r="180" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="250" cy="250" r="120" stroke="currentColor" strokeWidth="0.8" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <path
            key={deg}
            d="M 250,250 C 220,150 250,110 250,110 C 250,110 280,150 250,250 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            transform={`rotate(${deg} 250 250)`}
          />
        ))}
      </svg>
    </div>
  );
};
