"use client";

import React from "react";
import { motion } from "framer-motion";

export const FlyingRakhi: React.FC = () => {
  // Phase 1 of Synchronized 12s Relay:
  // 0s - 5.5s: Rakhi flies from Bottom-Left (10vw, 65vh) to Top-Right (82vw, 12vh)
  // 5.5s - 12s: Hidden while Gift Box flies back from Bottom-Right to Top-Left
  const flightVariants = {
    animate: {
      x: ["10vw", "10vw", "82vw", "82vw", "10vw"],
      y: ["65vh", "65vh", "12vh", "12vh", "65vh"],
      rotate: [-8, -4, 12, 12, -8],
      scale: [0.75, 0.95, 1, 0.8, 0.75],
      opacity: [0, 1, 1, 0, 0],
      transition: {
        duration: 12,
        times: [0, 0.04, 0.42, 0.46, 1],
        ease: "easeInOut",
        repeat: Infinity,
      },
    },
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      <motion.div
        className="absolute top-0 left-0 w-[240px] sm:w-[380px] md:w-[520px] lg:w-[620px]"
        variants={flightVariants}
        animate="animate"
      >
        <div className="relative w-full">
          {/* Subtle Motion Trail Glow Behind Flying Rakhi */}
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-3/4 h-24 bg-gradient-to-r from-amber-400/0 via-orange-400/25 to-amber-300/40 blur-xl rounded-full rakhi-motion-trail" />

          {/* Falling Petals & Sparkles around Flying Rakhi */}
          <div className="absolute top-1/3 left-1/4 w-32 h-32 pointer-events-none">
            <div className="absolute top-1 left-2 text-sm sm:text-base rakhi-sparkle-float" style={{ animationDelay: "0.3s" }}>
              🌸
            </div>
            <div className="absolute top-8 left-12 text-xs sm:text-sm text-pink-400 rakhi-sparkle-float" style={{ animationDelay: "1.1s" }}>
              🌸
            </div>
            <div className="absolute top-14 left-4 text-xs sm:text-sm text-amber-300 rakhi-sparkle-float" style={{ animationDelay: "0.6s" }}>
              ✨
            </div>
          </div>

          {/* Flying Rakhi Image (Image 3) */}
          <img
            src="/rakhi/flying-rakhi.png"
            alt="Flying Rakhi"
            className="w-full h-auto object-contain drop-shadow-2xl select-none"
          />
        </div>
      </motion.div>
    </div>
  );
};
