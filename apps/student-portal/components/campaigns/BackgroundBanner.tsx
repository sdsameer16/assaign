"use client";

import React from "react";

export const BackgroundBanner: React.FC = () => {
  return (
    <div className="absolute top-[140px] sm:top-[68px] md:top-[72px] left-0 right-0 w-full h-[450px] sm:h-[550px] md:h-[650px] pointer-events-none z-10 overflow-hidden">
      {/* Transparent Desktop Festive Overlay (Image 1 Background Removed) */}
      <img
        src="/rakhi/desktop-bg.png"
        alt="Raksha Bandhan Desktop Overlay"
        className="hidden md:block w-full h-full object-cover object-top opacity-100 transition-opacity duration-500 select-none"
      />

      {/* Transparent Mobile Festive Overlay (Image 2 Background Removed) */}
      <img
        src="/rakhi/mobile-bg.png"
        alt="Raksha Bandhan Mobile Overlay"
        className="block md:hidden w-full h-full object-cover object-top opacity-100 transition-opacity duration-500 select-none"
      />
    </div>
  );
};
