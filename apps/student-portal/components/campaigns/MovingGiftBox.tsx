"use client";

import React from "react";
import { motion } from "framer-motion";

export const MovingGiftBox: React.FC = () => {
  // Synchronized Relay Timeline (12s total duration):
  // Phase 1 (0s - 5.5s): Hidden while Flying Rakhi moves from Bottom-Left to Top-Right
  // Phase 2 (5.5s - 11.5s): Triggered right when Rakhi reaches Top-Right side.
  // Travels smoothly from Bottom-Right (82vw, 65vh) to Top-Left Corner (10vw, 12vh)
  const giftBoxTrajectoryVariants = {
    animate: {
      x: ["82vw", "82vw", "82vw", "10vw", "10vw", "82vw"],
      y: ["65vh", "65vh", "65vh", "12vh", "12vh", "65vh"],
      scale: [0.8, 0.8, 0.98, 1.06, 0.85, 0.8],
      opacity: [0, 0, 1, 1, 0, 0],
      transition: {
        duration: 12,
        times: [0, 0.46, 0.50, 0.88, 0.92, 1],
        ease: [0.25, 0.1, 0.25, 1], // Smooth aerodynamic flight curve
        repeat: Infinity,
      },
    },
  };

  // Smooth 3D Volumetric Float & Motion (Preserves 3D cube presence without crushing or flattening)
  const giftBox3DMotionVariants = {
    animate: {
      rotate: [0, 90, 180, 270, 360],
      rotateX: [10, -6, 10, -6, 10],
      rotateY: [-10, 10, -10, 10, -10],
      transition: {
        duration: 6.0,
        ease: "easeInOut",
        repeat: Infinity,
      },
    },
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("select-category-filter", { detail: "gifts" }));
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Trajectory Motion Container (Bottom-Right to Top-Left) */}
      <motion.div
        className="absolute top-0 left-0 w-28 h-28 sm:w-36 sm:h-36 md:w-48 md:h-48 drop-shadow-2xl"
        variants={giftBoxTrajectoryVariants}
        animate="animate"
      >
        {/* Volumetric 3D Perspective Container */}
        <div
          className="relative w-full h-full flex items-center justify-center cursor-pointer pointer-events-auto hover:scale-105 transition-transform"
          onClick={handleClick}
          title="Click to explore Gifts & Festive Items"
          style={{ perspective: 1000, transformStyle: "preserve-3d" }}
        >
          {/* Smooth Volumetric 3D Motion Container */}
          <motion.div
            className="w-full h-full"
            style={{ transformStyle: "preserve-3d" }}
            variants={giftBox3DMotionVariants}
            animate="animate"
          >
            {/* Pure Clean 3D Pink Gift Box Image (ONLY the 3D gift box - ZERO surrounding sparkles or titles) */}
            <img
              src="/rakhi/gift-box.png"
              alt="3D Pink Gift Box"
              className="w-full h-full object-contain drop-shadow-2xl select-none"
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};
