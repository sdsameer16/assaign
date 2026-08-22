"use client";

import React, { useState, useEffect } from "react";
import { rakhiCampaignConfig, isCampaignActive } from "../../lib/campaignConfig";
import { BackgroundBanner } from "./BackgroundBanner";
import { FlyingRakhi } from "./FlyingRakhi";
import { MovingGiftBox } from "./MovingGiftBox";

export const RakshaBandhanTheme: React.FC = () => {
  const [active, setActive] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    setActive(isCampaignActive(rakhiCampaignConfig));
  }, []);

  // Avoid hydration mismatches on server/client initial render
  if (!mounted || !active) {
    return null;
  }

  return (
    <aside
      aria-label="Raksha Bandhan Festive Campaign Layer"
      className="fixed inset-0 pointer-events-none z-10 overflow-hidden select-none"
    >
      {/* 1. Festive Background Banner Image Layer (Desktop: Image 1, Mobile: Image 2) */}
      <BackgroundBanner />

      {/* 2. Flying Rakhi Animation Layer (Image 3 - Responsive Scaling & Diagonal Flight) */}
      <FlyingRakhi />

      {/* 3. 3D Cube Gift Box with Pink Ribbon Moving Right to Left */}
      <MovingGiftBox />
    </aside>
  );
};
