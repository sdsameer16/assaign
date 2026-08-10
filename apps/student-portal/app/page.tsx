"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Trash2,
  ArrowRight,
  CheckCircle2,
  MapPin,
  User,
  Shield,
  Search,
  Star,
  Phone,
  Bell,
  Loader2,
  Sparkles,
  LogOut,
  Clock,
  HelpCircle,
  Headphones,
  X,
  Printer,
  Eye,
  Plus,
  Minus,
  ChevronRight,
  Utensils,
  Flame,
  Zap,
  Award,
  Percent,
  ShoppingBasket,
  RotateCcw,
  Building2,
  Tag,
  Mail,
  Sun,
  Moon,
} from "lucide-react";
import {
  Product,
  Category,
  Student,
  Order,
  PrintPricing,
  PrintColorMode,
  PrintSides,
  TrackingAd,
  MenuSchedule,
} from "@campusbites/types";

import { requestForToken, onMessageListener } from "../lib/firebase";
import {
  studentApi,
  getProfile,
  getToken,
  logout,
  setSession,
} from "../lib/api";

const AnimatedPrinterIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Top paper moving down */}
      <motion.polyline
        points="6 9 6 2 18 2 18 9"
        initial={{ y: -4, opacity: 0 }}
        animate={{ y: [-4, 0, 0, -4], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Printer body */}
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      {/* Bottom paper moving out */}
      <motion.rect
        width="12"
        height="8"
        x="6"
        y="14"
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: [-8, -8, 0, 0], opacity: [0, 0, 1, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
};

import {
  uploadPrintFile,
  uploadImageDataUrl,
  isAcceptedPrintFile,
} from "../lib/cloudinary";
import {
  countPrintPages,
  pageCountHint,
  billablePrintUnits,
  PageCountSource,
} from "../lib/printPageCount";

type CartPrintJob = {
  localId: string;
  file_url: string;
  file_name: string;
  file_type: string;
  color_mode: PrintColorMode;
  sides: PrintSides;
  page_count: number;
  copies: number;
  unit_price: number;
  line_total: number;
};

type PrintDraftFile = {
  file_url: string;
  file_name: string;
  file_type: string;
  page_count: number;
  estimated: number;
  source: PageCountSource;
};

const getVerificationCode = (orderNumber: string) => {
  if (!orderNumber) return "CB-58926";
  const parts = orderNumber.split("-");
  if (parts.length >= 2 && parts[1]) {
    return `CB-${parts[1]}`;
  }
  return orderNumber.startsWith("CB-") ? orderNumber : `CB-${orderNumber}`;
};

const StudentVerificationCodeCard = ({
  orderNumber,
  theme = "dark",
}: {
  orderNumber: string;
  theme?: string;
}) => {
  return (
    <div
      className={`space-y-2.5 p-4 border rounded-2xl transition-colors ${
        theme === "dark"
          ? "bg-slate-950/60 border-slate-800 text-slate-100"
          : "bg-slate-50 border-slate-300 text-slate-900"
      }`}
    >
      <div className="flex justify-between items-center">
        <label
          className={`text-[10px] font-black uppercase tracking-wider block ${
            theme === "dark" ? "text-slate-400" : "text-slate-600"
          }`}
        >
          STUDENT VERIFICATION CODE
        </label>
        <span
          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded animate-pulse ${
            theme === "dark"
              ? "bg-indigo-950/60 text-indigo-400 border border-indigo-800/40"
              : "bg-indigo-100 text-indigo-800 border border-indigo-200"
          }`}
        >
          SECURITY CODE CHECK
        </span>
      </div>
      <div
        className={`w-full border rounded-xl px-4 py-3.5 text-center font-mono font-black text-2xl tracking-widest uppercase shadow-inner flex items-center justify-center transition-colors ${
          theme === "dark"
            ? "bg-slate-950 border-slate-800 text-white"
            : "bg-white border-slate-300 text-slate-900"
        }`}
      >
        {getVerificationCode(orderNumber)}
      </div>
      <p
        className={`text-[11px] text-center px-4 leading-relaxed font-medium ${
          theme === "dark" ? "text-slate-400" : "text-slate-600"
        }`}
      >
        Visually verify this code with the student&apos;s screen before handing over the package.
      </p>
    </div>
  );
};

const FoodConveyorBelt = ({
  status,
  theme = "dark",
  isEnlarged = false,
}: {
  status: string;
  theme?: string;
  isEnlarged?: boolean;
}) => {
  const statusLabels: Record<string, string> = {
    received: "Order Received & Queued 📋",
    preparing: "Chef Cooking in Kitchen 🍳",
    packed: "Sealed & Quality Inspected 📦",
    assigned: "Dispatched to Floor Partner 🛵",
    out_for_delivery: "Out for Corridor Delivery 🚀",
    delivered: "Delivered to Room! Enjoy 😋",
  };

  const currentLabel = statusLabels[status] || "Order Processing";

  const foodIcons = ["🍔", "🍱", "🍕", "🥤", "🍟", "📦", "🍦", "☕", "🍔", "🍱", "🍕", "🥤", "🍟", "📦", "🍦", "☕"];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-colors ${
        theme === "dark"
          ? "bg-slate-950/80 border-slate-800 text-slate-100"
          : "bg-slate-50 border-slate-300 text-slate-900"
      } ${isEnlarged ? "p-5" : "p-4"}`}
    >
      {/* Header status indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-orange-500">
            {currentLabel}
          </span>
        </div>
        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/30">
          ⚡ Live Status
        </span>
      </div>

      {/* Floating Pure Food Icons Stream */}
      <div className="relative h-14 w-full overflow-hidden flex items-center">
        <motion.div
          className="flex items-center space-x-8 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: status === "preparing" ? 5 : status === "out_for_delivery" ? 3.5 : 7,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {foodIcons.map((icon, index) => (
            <span key={index} className="text-3xl shrink-0 select-none">
              {icon}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default function StudentPortal() {
  // Authentication & Profile states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Student | null>(null);
  const [mobileNumber, setMobileNumber] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Registration Form states
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState("");
  const [regRoll, setRegRoll] = useState("");
  const [regIDUrl, setRegIDUrl] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);

  // Menu & Category states
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuLoading, setMenuLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);


  // Cart & Persistence states
  const [cart, setCart] = useState<{ [product_id: string]: number }>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [printJobs, setPrintJobs] = useState<CartPrintJob[]>([]);
  const [printPricing, setPrintPricing] = useState<PrintPricing | null>(null);
  const [showPrintingsModal, setShowPrintingsModal] = useState(false);
  const [printUploading, setPrintUploading] = useState(false);
  const [printCounting, setPrintCounting] = useState(false);
  const [printDraftFiles, setPrintDraftFiles] = useState<PrintDraftFile[]>([]);
  const [printColorMode, setPrintColorMode] = useState<PrintColorMode>("bw");
  const [printSides, setPrintSides] = useState<PrintSides>("single");
  const [printCopies, setPrintCopies] = useState(1);

  // Saved Delivery Address states
  const [building, setBuilding] = useState("N Block");
  const [floor, setFloor] = useState(1);
  const [roomNumber, setRoomNumber] = useState("");
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Dynamic Delivery Config State
  const [deliveryFee, setDeliveryFee] = useState(15);
  const [minFreeDeliveryAmount, setMinFreeDeliveryAmount] = useState(100);

  // Privacy & Consent
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  // Payment Screen states
  const [activePayment, setActivePayment] = useState<any>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Multi-Order Active Tracking & Order History Modals
  const [activeOrderIDs, setActiveOrderIDs] = useState<string[]>([]);
  const [selectedTrackingID, setSelectedTrackingID] = useState<string | null>(null);
  const [trackingDetails, setTrackingDetails] = useState<any>(null);
  const [trackingAd, setTrackingAd] = useState<TrackingAd | null>(null);
  const [trackingMinimized, setTrackingMinimized] = useState(false);
  const [dismissedBannerIDs, setDismissedBannerIDs] = useState<string[]>([]);
  const [enlargedTrackingOrderID, setEnlargedTrackingOrderID] = useState<string | null>(null);
  const [enlargedTrackingDetails, setEnlargedTrackingDetails] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("dismissed_tracking_banner_ids");
      if (raw) {
        try {
          setDismissedBannerIDs(JSON.parse(raw));
        } catch (e) {}
      }
    }
  }, []);

  const handleDismissBanner = (orderID: string) => {
    const updated = [...dismissedBannerIDs, orderID];
    setDismissedBannerIDs(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("dismissed_tracking_banner_ids", JSON.stringify(updated));
    }
  };

  const handleOpenActiveOrders = async () => {
    try {
      const history = await studentApi.getHistory();
      setOrderHistory(history);
      const activeOrd = history.find(
        (o: any) => o.status !== "delivered" && o.status !== "cancelled" && o.status !== "out_of_stock"
      );
      if (activeOrd) {
        setDismissedBannerIDs((prev) => {
          const updated = prev.filter((id) => id !== activeOrd.id);
          if (typeof window !== "undefined") {
            localStorage.setItem("dismissed_tracking_banner_ids", JSON.stringify(updated));
          }
          return updated;
        });
        setSelectedTrackingID(activeOrd.id);
        setActiveOrderIDs((prev) => Array.from(new Set([...prev, activeOrd.id])));
        setShowHistoryModal(false);
        setEnlargedTrackingOrderID(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setShowHistoryModal(true);
      }
    } catch (e) {
      fetchOrderHistory();
      setShowHistoryModal(true);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (enlargedTrackingOrderID) {
      const fetchEnlarged = async () => {
        try {
          const res = await studentApi.trackOrder(enlargedTrackingOrderID);
          setEnlargedTrackingDetails(res);
        } catch (e) {
          console.error("Enlarged tracking error:", e);
        }
      };
      fetchEnlarged();
      interval = setInterval(fetchEnlarged, 4000);
    } else {
      setEnlargedTrackingDetails(null);
    }
    return () => clearInterval(interval);
  }, [enlargedTrackingOrderID]);

  // Auto-scroll to top & focus live delivery tracker upon order placement/selection
  useEffect(() => {
    if (selectedTrackingID && typeof window !== "undefined") {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        const trackerEl = document.getElementById("live-delivery-tracker");
        if (trackerEl) {
          trackerEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 150);
    }
  }, [selectedTrackingID]);

  const hasActiveTracker = useMemo(() => {
    return (
      activeOrderIDs.length > 0 &&
      selectedTrackingID !== null &&
      trackingDetails !== null &&
      !dismissedBannerIDs.includes(selectedTrackingID) &&
      trackingDetails?.order?.status !== "delivered" &&
      trackingDetails?.order?.status !== "cancelled" &&
      trackingDetails?.order?.status !== "out_of_stock"
    );
  }, [activeOrderIDs, selectedTrackingID, trackingDetails, dismissedBannerIDs]);
  const [showMenuExplorer, setShowMenuExplorer] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAccountDrawer, setShowAccountDrawer] = useState(false);
  const [ratingModalOrderID, setRatingModalOrderID] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [cutoffTime, setCutoffTime] = useState<string | null>(null);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [deliverySlots, setDeliverySlots] = useState<
    {
      id: string;
      name: string;
      delivery_start: string;
      delivery_end: string;
      order_cutoff: string;
      is_active: boolean;
      is_ordering_open: boolean;
    }[]
  >([]);

  const isCutoff0001 = (val: string | null) => {
    if (!val) return false;
    const clean = val.trim().toLowerCase();
    return (
      clean === "00:01" ||
      clean === "0:01" ||
      clean === "00:01:00" ||
      clean === "12:01 am" ||
      clean === "00:01 am" ||
      clean === "12:01:00 am"
    );
  };

  const is0001CutoffMode = useMemo(() => {
    if (isCutoff0001(cutoffTime)) return true;
    if (deliverySlots.length > 0 && deliverySlots.every((s) => isCutoff0001(s.order_cutoff))) {
      return true;
    }
    return false;
  }, [cutoffTime, deliverySlots]);

  const isAllSlotsClosed = useMemo(() => {
    if (deliverySlots.length === 0) return false;
    return !deliverySlots.some((s) => s.is_active && s.is_ordering_open);
  }, [deliverySlots]);

  const isGlobalCutoffPassed = useMemo(() => {
    if (!cutoffTime || isCutoff0001(cutoffTime)) return false;
    try {
      const clean = cutoffTime.trim().toUpperCase();
      const isPM = clean.includes("PM");
      const isAM = clean.includes("AM");
      const timeOnly = clean.replace(/AM|PM/g, "").trim();
      const parts = timeOnly.split(":");
      if (parts.length >= 2) {
        let cHour = parseInt(parts[0], 10);
        const cMin = parseInt(parts[1], 10);
        if (isNaN(cHour) || isNaN(cMin)) return false;

        if (isPM && cHour < 12) {
          cHour += 12;
        } else if (isAM && cHour === 12) {
          cHour = 0;
        }

        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const cutoffMinutes = cHour * 60 + cMin;
        return nowMinutes >= cutoffMinutes;
      }
    } catch (e) {}
    return false;
  }, [cutoffTime]);

  const isOrderingClosed = is0001CutoffMode || isAllSlotsClosed || isGlobalCutoffPassed;

  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("campusbites_theme", next);
    }
  };

  const [selectedSlotId, setSelectedSlotId] = useState("");

  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const menuSectionRef = useRef<HTMLDivElement | null>(null);

  // Load session, stored location, menu & cart on initialization
  // Lock background page scroll completely on mobile touch devices when cart or modal is open
  useEffect(() => {
    if (isCartOpen || showAddressModal || showHistoryModal || showAccountDrawer || showPrintingsModal) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      return () => {
        const savedY = Math.abs(parseInt(document.body.style.top || "0", 10));
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
        window.scrollTo(0, savedY);
      };
    }
  }, [isCartOpen, showAddressModal, showHistoryModal, showAccountDrawer, showPrintingsModal]);

  useEffect(() => {
    const savedToken = getToken();
    const savedProfile = getProfile();
    if (savedToken && savedProfile) {
      setToken(savedToken);
      setProfile(savedProfile);
      setIsLoggedIn(true);
      if (savedProfile.last_room_number) {
        setRoomNumber(savedProfile.last_room_number);
      }
      checkForActiveOrder();
      checkPrivacyStatus();
      fetchOrderHistory();
    }

    // Load saved theme and delivery location from localStorage
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("campusbites_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme as any);
      }

      const savedLoc = localStorage.getItem("campusbites_saved_location");

      if (savedLoc) {
        try {
          const parsed = JSON.parse(savedLoc);
          if (parsed.building) setBuilding(parsed.building);
          if (parsed.floor) setFloor(parsed.floor);
          if (parsed.roomNumber) setRoomNumber(parsed.roomNumber);
        } catch (e) { }
      }
    }

    loadMenu();
    fetchCutoffConfig();
    fetchDeliverySlots();
    fetchDeliveryConfig();
    fetchPrintPricing();
    initializeCartState(Boolean(savedToken));
  }, []);

  const fetchDeliveryConfig = async () => {
    try {
      const cfg = await studentApi.getDeliveryConfig();
      if (cfg) {
        setDeliveryFee(cfg.delivery_fee);
        setMinFreeDeliveryAmount(cfg.min_free_delivery_amount);
      }
    } catch (e) {
      console.error("Failed to load delivery config:", e);
    }
  };


  // Sync cart items with backend (if logged in) or localStorage (if guest)
  const syncCartState = async (
    updatedCart: { [product_id: string]: number },
    isAuth: boolean
  ) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("campusbites_cart_cache", JSON.stringify(updatedCart));
    }
    const items = Object.entries(updatedCart).map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));

    if (isAuth) {
      try {
        await studentApi.updateCart(items);
      } catch (e) {
        console.error("Failed to sync cart with backend:", e);
      }
    } else if (typeof window !== "undefined") {
      localStorage.setItem("campusbites_guest_cart", JSON.stringify(updatedCart));
    }
  };

  const initializeCartState = async (loggedIn: boolean) => {
    if (loggedIn) {
      try {
        let guestCartMap: { [key: string]: number } = {};
        const guestRaw =
          typeof window !== "undefined"
            ? localStorage.getItem("campusbites_guest_cart")
            : null;
        if (guestRaw) {
          try {
            guestCartMap = JSON.parse(guestRaw);
          } catch (e) { }
        }
        const guestItems = Object.entries(guestCartMap).map(
          ([product_id, quantity]) => ({ product_id, quantity })
        );

        if (guestItems.length > 0) {
          const res = await studentApi.mergeCart(guestItems);
          if (typeof window !== "undefined") {
            localStorage.removeItem("campusbites_guest_cart");
          }
          const mergedMap: { [key: string]: number } = {};
          (res.items || []).forEach((it) => {
            if (it.quantity > 0) mergedMap[it.product_id] = it.quantity;
          });
          setCart(mergedMap);
        } else {
          const res = await studentApi.getCart();
          const serverMap: { [key: string]: number } = {};
          (res.items || []).forEach((it) => {
            if (it.quantity > 0) serverMap[it.product_id] = it.quantity;
          });
          setCart(serverMap);
        }
      } catch (e) {
        console.error("Failed to load user cart:", e);
        const cacheRaw =
          typeof window !== "undefined"
            ? localStorage.getItem("campusbites_cart_cache")
            : null;
        if (cacheRaw) {
          try {
            setCart(JSON.parse(cacheRaw));
          } catch (err) { }
        }
      }
    } else {
      const guestRaw =
        typeof window !== "undefined"
          ? localStorage.getItem("campusbites_guest_cart")
          : null;
      if (guestRaw) {
        try {
          setCart(JSON.parse(guestRaw));
        } catch (e) { }
      }
    }
  };

  const fetchPrintPricing = async () => {
    try {
      const data = await studentApi.getPrintPricing();
      setPrintPricing(data);
    } catch (e) {
      console.error("Failed to load print pricing:", e);
    }
  };

  const fetchOrderHistory = async () => {
    try {
      const history = await studentApi.getHistory();
      setOrderHistory(history || []);
    } catch (e) {
      console.error("Failed to load order history:", e);
    }
  };

  const checkPrivacyStatus = async () => {
    try {
      const res = await studentApi.getPrivacy();
      if (!res.accepted) {
        setShowPrivacyModal(true);
      }
    } catch (e) {
      console.error("Failed to check privacy status:", e);
    }
  };

  const handleAcceptPrivacy = async () => {
    setPrivacyLoading(true);
    try {
      await studentApi.acceptPrivacy();
      setShowPrivacyModal(false);
    } catch (e) {
      alert("Failed to accept privacy policy. Please try again.");
    } finally {
      setPrivacyLoading(false);
    }
  };

  const checkForActiveOrder = async () => {
    try {
      const history = await studentApi.getHistory();
      if (history && history.length > 0) {
        const dismissedRaw =
          typeof window !== "undefined"
            ? localStorage.getItem("dismissed_out_of_stock")
            : null;
        const dismissed: string[] = dismissedRaw
          ? JSON.parse(dismissedRaw)
          : [];
        const activeOrders = history.filter(
          (o) =>
            o.status !== "delivered" &&
            o.status !== "cancelled" &&
            o.payment_status === "paid" &&
            !(o.status === "out_of_stock" && dismissed.includes(o.id))
        );
        const ids = activeOrders.map((o) => o.id);
        setActiveOrderIDs(ids);
        if (ids.length > 0) {
          setSelectedTrackingID((prev) => (ids.includes(prev || "") ? prev : ids[0]));
        } else {
          setSelectedTrackingID(null);
        }
      }
    } catch (e) {
      console.error("Failed to check for active order:", e);
    }
  };

  const fetchCutoffConfig = async () => {
    try {
      const data = await studentApi.getCutoff();
      if (data && data.cutoff_time) {
        setCutoffTime(data.cutoff_time);
      }
    } catch (e) {
      console.error("Failed to load order cutoff config:", e);
    }
  };

  const fetchDeliverySlots = async () => {
    try {
      const slots = await studentApi.getDeliverySlots();
      setDeliverySlots(slots || []);
      setSelectedSlotId((prev) => {
        if (!prev) return prev;
        const stillOpen = (slots || []).find(
          (s) => s.id === prev && s.is_ordering_open
        );
        return stillOpen ? prev : "";
      });
    } catch (e) {
      console.error("Failed to load delivery slots:", e);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedTrackingID) {
      fetchTracking();
      fetchTrackingAd();
      interval = setInterval(fetchTracking, 4000);
    } else {
      setTrackingAd(null);
      setTrackingMinimized(false);
    }
    return () => clearInterval(interval);
  }, [selectedTrackingID]);

  const fetchTracking = async () => {
    if (!selectedTrackingID) return;
    try {
      const res = await studentApi.trackOrder(selectedTrackingID);
      setTrackingDetails(res);
    } catch (e: any) {
      console.error("Tracking error:", e);
      setActiveOrderIDs((prev) => prev.filter((id) => id !== selectedTrackingID));
      setSelectedTrackingID(null);
      setTrackingDetails(null);
    }
  };



  const fetchTrackingAd = async () => {
    try {
      const ad = await studentApi.getTrackingAd();
      setTrackingAd(ad);
      const active = Boolean(ad?.is_enabled && ad?.image_url);
      setTrackingMinimized(active);
    } catch (e) {
      console.error("Failed to load tracking ad:", e);
      setTrackingAd(null);
      setTrackingMinimized(false);
    }
  };

  const loadMenu = async () => {
    try {
      setMenuLoading(true);
      setNetworkError(false);
      const data = await studentApi.getMenu();
      setCategories(data.categories || []);
      setProducts(
        (data.products || []).filter(
          (p: Product) =>
            p.is_available &&
            !p.name.toLowerCase().includes("load test") &&
            !p.name.toLowerCase().includes("test category")
        )
      );
    } catch (e) {
      console.error("Failed to load food catalog:", e);
      setNetworkError(true);
    } finally {
      setMenuLoading(false);
    }
  };


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber) return;
    try {
      setIsLoginLoading(true);
      const data = await studentApi.login(mobileNumber);
      setSession(data.token, data.student);
      setToken(data.token);
      setProfile(data.student);
      if (data.student.last_room_number) {
        setRoomNumber(data.student.last_room_number);
      }
      setIsLoggedIn(true);
      await initializeCartState(true);
      checkForActiveOrder();
      checkPrivacyStatus();
      fetchOrderHistory();
    } catch (err: any) {
      if (err.message.includes("not found")) {
        setIsRegistering(true);
      } else {
        alert(err.message);
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  const runServerOcrPreview = async (idCardUrl: string) => {
    if (!regName.trim() || !regRoll.trim() || !idCardUrl) return;
    setOcrLoading(true);
    try {
      const result = await studentApi.previewOcr({
        short_name: regName.trim(),
        roll_number: regRoll.trim(),
        id_card_url: idCardUrl,
      });
      setOcrResult({
        extracted_name: result.extracted_name,
        extracted_roll: result.extracted_roll,
        similarity_score: result.similarity_score,
        confidence: result.confidence,
      });
    } catch (ocrErr: any) {
      setOcrResult(null);
      alert(
        ocrErr?.message ||
        "Could not read your ID card. Please retake a clear photo and try again."
      );
    } finally {
      setOcrLoading(false);
    }
  };

  const startCamera = async () => {
    if (!regName.trim() || !regRoll.trim()) {
      alert(
        "Please enter your Short Name and College Roll Number before scanning your ID card."
      );
      return;
    }
    try {
      setShowCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setCameraStream(stream);
    } catch (err: any) {
      alert("Could not access camera: " + err.message);
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        stopCamera();
        setOcrLoading(true);

        const secureUrl = await uploadImageDataUrl(dataUrl);
        setRegIDUrl(secureUrl);
        await runServerOcrPreview(secureUrl);
      }
    } catch (e: any) {
      alert("Capture failed: " + e.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regRoll || !mobileNumber) return;
    if (!regIDUrl) {
      alert("Please scan your college ID card before registering.");
      return;
    }
    if (!ocrResult || ocrResult.similarity_score < 60) {
      alert(
        "ID card scan did not match well enough. Please retake a clear photo of your ID."
      );
      return;
    }
    try {
      setIsLoginLoading(true);
      const data = await studentApi.register({
        mobile_number: mobileNumber,
        short_name: regName,
        roll_number: regRoll,
        id_card_url: regIDUrl,
      });
      setSession(data.token, data.student);
      setToken(data.token);
      setProfile(data.student);
      setIsLoggedIn(true);
      setIsRegistering(false);
      setOcrResult(null);
      await initializeCartState(true);
      checkForActiveOrder();
      checkPrivacyStatus();
      fetchOrderHistory();
    } catch (err: any) {
      alert("Registration failed: " + err.message);
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setProfile(null);
    setToken(null);
    setCart({});
    setPrintJobs([]);
    setActiveOrderIDs([]);
    setSelectedTrackingID(null);
    setTrackingDetails(null);
    setShowMenuExplorer(false);

    if (typeof window !== "undefined") {
      localStorage.removeItem("campusbites_cart_cache");
    }
  };

  // Saved Location Persistence
  const saveDeliveryAddress = (bld: string, flr: number, rm: string) => {
    setBuilding(bld);
    setFloor(flr);
    setRoomNumber(rm);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "campusbites_saved_location",
        JSON.stringify({ building: bld, floor: flr, roomNumber: rm })
      );
    }
    setShowAddressModal(false);
  };

  // Cart operations with sync
  const addToCart = (productId: string) => {
    setCart((prev) => {
      const updated = { ...prev, [productId]: (prev[productId] || 0) + 1 };
      syncCartState(updated, isLoggedIn);
      return updated;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const updated = { ...prev };
      if (!updated[productId] || updated[productId] <= 1) {
        delete updated[productId];
      } else {
        updated[productId]--;
      }
      syncCartState(updated, isLoggedIn);
      return updated;
    });
  };

  const deleteItemFromCart = (productId: string) => {
    setCart((prev) => {
      const updated = { ...prev };
      delete updated[productId];
      syncCartState(updated, isLoggedIn);
      return updated;
    });
  };

  // Printing Service logic
  const handlePrintFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    for (const file of files) {
      if (!isAcceptedPrintFile(file.name)) {
        alert(
          `Unsupported file: ${file.name}. Accepted: pdf, doc, docx, xls, xlsx, jpeg, jpg, png`
        );
        return;
      }
    }

    try {
      setPrintUploading(true);
      setPrintCounting(true);
      if (!printPricing) await fetchPrintPricing();
      const uploaded: PrintDraftFile[] = [];
      for (const file of files) {
        const [result, pages] = await Promise.all([
          uploadPrintFile(file),
          countPrintPages(file),
        ]);
        uploaded.push({
          file_url: result.url,
          file_name: result.fileName,
          file_type: result.fileType,
          page_count: pages.billed,
          estimated: pages.estimated,
          source: pages.source,
        });
      }
      setPrintDraftFiles((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setPrintUploading(false);
      setPrintCounting(false);
    }
  };

  const rateForPrintOptions = (
    pricing: PrintPricing,
    colorMode: PrintColorMode,
    sides: PrintSides
  ) => {
    if (colorMode === "bw") {
      return sides === "double" ? pricing.bw_double : pricing.bw_single;
    }
    return sides === "double" ? pricing.color_double : pricing.color_single;
  };

  const getDraftBillableUnits = () =>
    printDraftFiles.reduce(
      (sum, f) => sum + billablePrintUnits(f.page_count || 0, printSides),
      0
    );

  const getPrintPreviewTotal = () => {
    if (!printPricing || printDraftFiles.length === 0) return 0;
    const unit = rateForPrintOptions(printPricing, printColorMode, printSides);
    return unit * getDraftBillableUnits() * printCopies;
  };

  const addPrintJobsToCart = () => {
    if (!printPricing) return;
    if (printDraftFiles.length === 0) {
      alert("Please upload at least one document.");
      return;
    }
    const unit = rateForPrintOptions(printPricing, printColorMode, printSides);
    const newJobs: CartPrintJob[] = printDraftFiles.map((f) => {
      const units = billablePrintUnits(f.page_count, printSides);
      return {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file_url: f.file_url,
        file_name: f.file_name,
        file_type: f.file_type,
        color_mode: printColorMode,
        sides: printSides,
        page_count: f.page_count,
        copies: printCopies,
        unit_price: unit,
        line_total: unit * units * printCopies,
      };
    });

    setPrintJobs((prev) => [...prev, ...newJobs]);
    setPrintDraftFiles([]);
    setPrintCopies(1);
    setPrintColorMode("bw");
    setPrintSides("single");
    setShowPrintingsModal(false);
    setIsCartOpen(true);
  };

  const removePrintJob = (localId: string) => {
    setPrintJobs((prev) => prev.filter((j) => j.localId !== localId));
  };

  // Price & Cart Calculations
  const getFoodTotal = () => {
    return Object.entries(cart).reduce((total, [id, qty]) => {
      const prod = products.find((p) => p.id === id);
      return total + (prod ? prod.selling_price * qty : 0);
    }, 0);
  };

  const getPrintTotal = () => {
    return printJobs.reduce((sum, j) => sum + j.line_total, 0);
  };

  const getSubtotal = () => getFoodTotal() + getPrintTotal();
  const freeDeliveryThreshold = minFreeDeliveryAmount;
  const currentDeliveryFee = getSubtotal() >= freeDeliveryThreshold || getSubtotal() === 0 ? 0 : deliveryFee;
  const getFinalTotal = () => getSubtotal() + currentDeliveryFee;


  const getCartItemCount = () => {
    return (
      Object.values(cart).reduce((sum, qty) => sum + qty, 0) + printJobs.length
    );
  };

  // Dynamic Time Greeting
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    const name = profile?.short_name || "Student";
    if (hour >= 5 && hour < 12)
      return {
        title: `Good Morning, ${name} 🔆`,
        period: "Morning",
        subtitle: "Fresh breakfast, idly, parathas & hot coffee delivered to your floor",
        tag: "🍳 Breakfast Specials",
        buttonText: "Order Breakfast",
        categoryId: "breakfast",
      };
    if (hour >= 12 && hour < 17)
      return {
        title: `Good Afternoon, ${name} 🌤️`,
        period: "Lunch",
        subtitle: "Hot biryani, meals, fried rice & thalis ready for corridor delivery",
        tag: "🍗 Lunch Feast",
        buttonText: "Order Lunch",
        categoryId: "meals",
      };
    if (hour >= 17 && hour < 22)
      return {
        title: `Good Evening, ${name} 🌆`,
        period: "Evening",
        subtitle: "Crispy momos, burgers, fries & cold coffee for evening study breaks",
        tag: "🍟 Evening Cravings",
        buttonText: "Order Snacks",
        categoryId: "snacks",
      };
    return {
      title: `Late night cravings, ${name}? 🌙`,
      period: "Night",
      subtitle: "Midnight maggi, rolls, snacks & drinks delivered straight to your room",
      tag: "🌙 Late Night Menu",
      buttonText: "Order Late Night",
      categoryId: "deals",
    };
  };

  const timeGreeting = getTimeGreeting();

  // Categories & Filtering
  const cleanCategories = useMemo(() => {
    return categories.filter(
      (c) =>
        !c.name.toLowerCase().includes("load test") &&
        !c.name.toLowerCase().includes("test category")
    );
  }, [categories]);

  // Derived recommendation IDs based on order history
  const recommendedProductIds = useMemo(() => {
    if (!orderHistory || orderHistory.length === 0) return [];
    const counts: Record<string, number> = {};
    orderHistory.forEach(order => {
      order.items?.forEach(item => {
        counts[item.product_id] = (counts[item.product_id] || 0) + item.quantity;
      });
    });
    // Sort by most ordered
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [orderHistory]);

  // Main UI Food Category Tabs
  const foodCategoryList = useMemo(() => {
    const list = [
      { id: "all", name: "All Food", icon: "🍽️" },
      { id: "breakfast", name: "Breakfast", icon: "🍳" },
      { id: "biryani", name: "Biryani", icon: "🍗" },
      { id: "fast food", name: "Fast Food", icon: "🍔" },
      { id: "meals", name: "Meals", icon: "🍲" },
      { id: "snacks", name: "Snacks", icon: "🍟" },
      { id: "beverages", name: "Beverages", icon: "🥤" },
      { id: "ice creams", name: "Ice Creams", icon: "🍦" },
      { id: "desserts", name: "Desserts", icon: "🍰" },
      { id: "combos", name: "Combos", icon: "🍱" },
      { id: "deals", name: "Student Deals", icon: "🎓" },
    ];
    if (isLoggedIn && recommendedProductIds.length > 0) {
      list.splice(1, 0, { id: "recommended", name: "Recommended", icon: "⭐" });
    }
    return list;
  }, [isLoggedIn, recommendedProductIds.length]);

  // Dynamic Product Filters
  const filteredProducts = useMemo(() => {
    const res = products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const catObj = cleanCategories.find((c) => c.id === p.category_id);
      const catName = catObj ? catObj.name.toLowerCase() : "";
      const pName = p.name.toLowerCase();

      let matchesSearch = true;
      if (q) {
        if (q.includes("under") || q.includes("<") || q.includes("budget")) {
          const numMatch = q.match(/\d+/);
          const limit = numMatch ? parseInt(numMatch[0], 10) : 50;
          matchesSearch = p.selling_price <= limit;
        } else {
          matchesSearch = pName.includes(q) || catName.includes(q);
        }
      }

      if (!matchesSearch) return false;

      if (selectedCategory === "all") return true;
      if (selectedCategory === "combos") return pName.includes("combo") || catName.includes("combo");
      if (selectedCategory === "deals") return p.mrp > p.selling_price || pName.includes("deal");
      if (selectedCategory === "recommended") return recommendedProductIds.includes(p.id);

      return catName.includes(selectedCategory) || pName.includes(selectedCategory);
    });

    if (selectedCategory === "recommended") {
      // Sort recommended products by frequency
      res.sort((a: Product, b: Product) => recommendedProductIds.indexOf(a.id) - recommendedProductIds.indexOf(b.id));
    }
    return res;
  }, [products, cleanCategories, selectedCategory, searchQuery, recommendedProductIds]);

  // Popular items with real order statistics where available
  const popularProducts = useMemo(() => {
    return products.slice(0, 4);
  }, [products]);

  // Under ₹50 budget discovery
  const budgetProducts = useMemo(() => {
    return products.filter((p) => p.selling_price <= 50);
  }, [products]);

  const [dbSchedules, setDbSchedules] = useState<MenuSchedule[]>([]);

  useEffect(() => {
    studentApi
      .getMenuSchedules()
      .then((schedules) => setDbSchedules(schedules || []))
      .catch((err) => console.error("Failed to load db menu schedules:", err));
  }, []);

  const activeSchedule = useMemo(() => {
    if (!dbSchedules || dbSchedules.length === 0) return null;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    return dbSchedules.find((s) => {
      if (!s.is_enabled) return false;
      const [sh, sm] = (s.start_time || "00:00").split(":").map((n) => parseInt(n, 10) || 0);
      const [eh, em] = (s.end_time || "23:59").split(":").map((n) => parseInt(n, 10) || 0);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      if (startMins <= endMins) {
        return currentMins >= startMins && currentMins < endMins;
      } else {
        return currentMins >= startMins || currentMins < endMins;
      }
    });
  }, [dbSchedules]);

  // Dynamic Time Highlights (Integrates Admin DB Menu Schedules when configured)
  const timeHighlights = useMemo(() => {
    const period = timeGreeting.period;
    const available = products.filter((p) => p.is_available !== false);

    const getCat = (p: Product) =>
      (categories.find((c) => c.id === p.category_id)?.name || "").toLowerCase();

    // If active admin schedule exists with assigned categories, prioritize DB schedule categories!
    if (activeSchedule && activeSchedule.categories && activeSchedule.categories.length > 0) {
      const scheduledCatIDs = new Set(activeSchedule.categories.map((c) => c.category_id));
      const scheduledItems = available.filter((p) => scheduledCatIDs.has(p.category_id));
      if (scheduledItems.length >= 2) {
        return scheduledItems.slice(0, 4);
      }
    }



    const isJunkOrSnack = (p: Product) => {
      const name = p.name.toLowerCase();
      const cat = getCat(p);
      return (
        cat.includes("snack") ||
        cat.includes("biscuit") ||
        cat.includes("chocolate") ||
        cat.includes("dessert") ||
        cat.includes("beverage") ||
        cat.includes("drink") ||
        name.includes("oreo") ||
        name.includes("kitkat") ||
        name.includes("chocolate") ||
        name.includes("biscuit") ||
        name.includes("puff") ||
        name.includes("chips") ||
        name.includes("candy") ||
        name.includes("drink") ||
        name.includes("cookie")
      );
    };

    let items: Product[] = [];
    if (period === "Morning") {
      items = available.filter((p) => {
        const name = p.name.toLowerCase();
        const cat = getCat(p);
        return (
          cat.includes("breakfast") ||
          name.includes("idly") ||
          name.includes("dosa") ||
          name.includes("paratha") ||
          name.includes("tea") ||
          name.includes("coffee") ||
          name.includes("poha") ||
          name.includes("omelette") ||
          name.includes("sandwich")
        );
      });
    } else if (period === "Lunch") {
      items = available.filter((p) => {
        if (isJunkOrSnack(p)) return false;
        const name = p.name.toLowerCase();
        const cat = getCat(p);
        return (
          cat.includes("meals") ||
          cat.includes("biryani") ||
          cat.includes("main") ||
          name.includes("biryani") ||
          name.includes("meal") ||
          name.includes("rice") ||
          name.includes("thali") ||
          name.includes("curry") ||
          name.includes("paneer") ||
          name.includes("chicken") ||
          name.includes("roti") ||
          name.includes("dal") ||
          name.includes("paratha") ||
          name.includes("pulao")
        );
      });
    } else if (period === "Evening") {
      items = available.filter((p) => {
        const name = p.name.toLowerCase();
        const cat = getCat(p);
        return (
          cat.includes("snack") ||
          cat.includes("fast food") ||
          cat.includes("beverage") ||
          name.includes("samosa") ||
          name.includes("momo") ||
          name.includes("burger") ||
          name.includes("maggi") ||
          name.includes("tea") ||
          name.includes("coffee") ||
          name.includes("fries") ||
          name.includes("roll")
        );
      });
    } else {
      items = available.filter((p) => {
        const name = p.name.toLowerCase();
        const cat = getCat(p);
        return (
          cat.includes("fast food") ||
          cat.includes("snack") ||
          name.includes("maggi") ||
          name.includes("burger") ||
          name.includes("pizza") ||
          name.includes("roll") ||
          name.includes("noodle")
        );
      });
    }

    if (items.length < 4) {
      const existingIds = new Set(items.map((i) => i.id));
      for (const p of available) {
        if (!existingIds.has(p.id) && (period !== "Lunch" || !isJunkOrSnack(p))) {
          items.push(p);
          if (items.length >= 4) break;
        }
      }
    }

    return items.slice(0, 4);
  }, [products, categories, timeGreeting.period, activeSchedule]);





  // Food Combos
  const comboProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes("combo") ||
        p.mrp - p.selling_price >= 20
    );
  }, [products]);

  // Reorder items from past history
  const pastOrderedProducts = useMemo(() => {
    const productMap = new Map<string, Product>();
    orderHistory.forEach((o) => {
      o.items?.forEach((item) => {
        const found = products.find((p) => p.id === item.product_id);
        if (found) productMap.set(found.id, found);
      });
    });
    return Array.from(productMap.values());
  }, [orderHistory, products]);

  // Razorpay Checkout handler
  const handleCheckout = async () => {
    if (!isLoggedIn) {
      alert("Please log in with your mobile number to place an order.");
      return;
    }
    if (!roomNumber.trim()) {
      alert("Please enter your Room Number for corridor delivery.");
      setShowAddressModal(true);
      return;
    }
    if (getCartItemCount() === 0) {
      alert("Your cart is empty. Add some food or print jobs first!");
      return;
    }

    if (is0001CutoffMode) {
      alert(
        "🚀 Something BIG is Cooking!\nWe're taking a short break today to bring you something even better.\nCampusBites will be back tomorrow! ❤️\n\nStay tuned — we've got something special coming your way. 🔥"
      );
      return;
    }

    if (isOrderingClosed) {
      alert(
        "🌙 Ordering is closed right now! All delivery slots for today have passed their cutoff time. Please check back tomorrow morning."
      );
      return;
    }

    // Auto-select open slot if needed
    const openSlot = deliverySlots.find((s) => s.is_ordering_open && s.is_active);
    const targetSlotId = selectedSlotId || (openSlot ? openSlot.id : "");

    if (!targetSlotId) {
      alert("🌙 Ordering is closed right now! All delivery slots for today have passed their cutoff time. Please check back tomorrow morning.");
      return;
    }

    try {
      setCheckoutLoading(true);
      const itemsPayload = Object.entries(cart).map(([product_id, quantity]) => ({
        product_id,
        quantity,
      }));

      const printJobsPayload = printJobs.map((j) => ({
        file_url: j.file_url,
        file_name: j.file_name,
        file_type: j.file_type,
        color_mode: j.color_mode,
        sides: j.sides,
        page_count: j.page_count,
        copies: j.copies,
      }));

      const orderData = await studentApi.createOrder({
        room_number: roomNumber,
        building: building,
        floor: floor,
        special_instructions: specialInstructions,
        delivery_slot_id: targetSlotId,
        items: itemsPayload,
        print_jobs: printJobsPayload,
      });

      // Reset & empty cart immediately upon successful order placement
      setCart({});
      setPrintJobs([]);
      if (typeof window !== "undefined") {
        localStorage.removeItem("campusbites_cart_cache");
        localStorage.removeItem("campusbites_guest_cart");
      }
      syncCartState({}, isLoggedIn);

      setActiveOrderIDs((prev) => Array.from(new Set([...prev, orderData.order_id])));
      setSelectedTrackingID(orderData.order_id);
      setIsCartOpen(false);
      fetchOrderHistory();

      if ((window as any).Razorpay && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: Math.round(orderData.total_amount * 100),
          currency: "INR",
          name: "CampusBites",
          description: `Order #${orderData.order_number} (Floor Delivery)`,
          order_id: orderData.razorpay_order_id,
          handler: async (response: any) => {
            try {
              await studentApi.verifyPayment({
                order_id: orderData.order_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              fetchOrderHistory();
            } catch (e: any) {
              alert("Payment verification failed: " + e.message);
            }
          },

          prefill: {
            name: profile?.short_name || "Student",
            contact: profile?.mobile_number || "",
          },
          theme: { color: "#f97316" },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        alert("Order created successfully! Multi-order tracker live.");
      }
    } catch (err: any) {
      alert("Failed to place order: " + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };



  const scrollToMenu = () => {
    setIsCartOpen(false);
    menuSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className={`min-h-screen font-sans pb-24 transition-colors duration-300 ${theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      {/* Header & Fixed Top Bar */}
      <header
        style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }}
        className={`border-b shadow-md transition-colors duration-300 ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 text-slate-900"}`}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

          {/* Logo & Platform Tagline */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-md shadow-orange-500/20 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className={`font-extrabold text-lg tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  Campus Bites
                </span>
                {/*  */}
              </div>
              <p className={`text-[11px] hidden sm:block font-medium ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                Everything You Crave, Delivered to Your Floor
              </p>
            </div>
          </div>

          {/* Header Top Bar Controls */}
          <div className="flex items-center space-x-2">
            {/* Delivery Location Indicator */}
            <button
              onClick={() => setShowAddressModal(true)}
              className={`border rounded-xl px-2.5 py-1.5 text-xs flex items-center space-x-1.5 transition ${theme === "dark"
                ? "bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200"
                : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900 shadow-sm"
                }`}
            >
              <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className={`font-bold text-xs truncate max-w-[110px] sm:max-w-none ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>
                {roomNumber ? `${building} R-${roomNumber}` : "Set Location"}
              </span>
            </button>

            {/* Desktop-only action buttons */}
            <div className="hidden sm:flex items-center space-x-2">
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-orange-500/20 transition active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>₹{getSubtotal()}</span>
                {getCartItemCount() > 0 && (
                  <span className="bg-slate-950 text-orange-400 font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center ml-1">
                    {getCartItemCount()}
                  </span>
                )}
              </button>

              {isLoggedIn && (
                <>
                  <button
                    onClick={handleOpenActiveOrders}
                    title="My Orders & Active Tracking"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center space-x-1.5"
                  >
                    <Clock className="w-4 h-4 text-orange-400" />
                    <span>My Orders</span>
                  </button>
                  <button
                    onClick={() => setShowPrintingsModal(true)}
                    title="Printings"
                    className="bg-orange-500 hover:bg-orange-600 text-slate-950 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-orange-500/20"
                  >
                    <AnimatedPrinterIcon className="w-4 h-4" />
                    <span>Printings</span>
                  </button>
                </>
              )}
            </div>

            {/* Light / Dark Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
              className={
                theme === "dark"
                  ? "bg-slate-800 hover:bg-slate-700 text-amber-400 p-2 rounded-xl transition"
                  : "bg-slate-200 hover:bg-slate-300 text-amber-600 p-2 rounded-xl transition border border-slate-300"
              }
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Profile / Account Trigger */}
            {isLoggedIn ? (
              <button
                onClick={() => setShowAccountDrawer(true)}
                title="Account Menu"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl transition flex items-center space-x-1"
              >
                <User className="w-4 h-4 text-orange-400" />
              </button>
            ) : (
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition"
              >
                Login
              </button>
            )}
          </div>
        </div>

        {/* Mobile Primary Navigation Bar (2-Row Layout Directly Below Title for < sm screens) */}
        <div className={`sm:hidden border-t px-3 py-2 space-y-1.5 transition-colors duration-300 ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={scrollToMenu}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 border transition active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850"
                  : "bg-white border-slate-300 text-slate-900 shadow-sm"
              }`}
            >
              <Utensils className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Home</span>
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1 shadow-md transition active:scale-95"
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span>Cart ({getCartItemCount()})</span>
            </button>

            <button
              onClick={() => {
                if (isLoggedIn) {
                  handleOpenActiveOrders();
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 border transition active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850"
                  : "bg-white border-slate-300 text-slate-900 shadow-sm"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Orders</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setShowPrintingsModal(true)}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 border transition active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850"
                  : "bg-white border-slate-300 text-slate-900 shadow-sm"
              }`}
            >
              <AnimatedPrinterIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Printings</span>
            </button>

            <button
              onClick={() => {
                if (isLoggedIn) {
                  setShowAccountDrawer(true);
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 border transition active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850"
                  : "bg-white border-slate-300 text-slate-900 shadow-sm"
              }`}
            >
              <User className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="truncate">{isLoggedIn ? (profile?.short_name || "Account") : "Login"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* PROMINENT TOP ACTIVE ORDER TRACKER BANNER (DISPLAYED ABOVE HEADER FOR EASY CROSS (X) ICON NAVIGATION) */}
      {hasActiveTracker && (
        <section id="live-delivery-tracker" className="relative z-[10000] pt-3 px-3 sm:px-4 max-w-5xl mx-auto">
          <div className={`border rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5 transition-colors ${
            theme === "dark"
              ? "bg-slate-900 border-slate-800 text-slate-100"
              : "bg-white border-slate-200 text-slate-900 shadow-xl"
          }`}>
            {/* Multi-Order Tabs */}
            {activeOrderIDs.length > 1 && (
              <div className="flex items-center space-x-2 border-b border-slate-800/60 pb-3 overflow-x-auto">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex-shrink-0">
                  Active Orders ({activeOrderIDs.length}):
                </span>
                {activeOrderIDs.map((id, index) => {
                  const isSel = id === selectedTrackingID;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedTrackingID(id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 flex-shrink-0 ${isSel
                        ? "bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-750"
                        }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Order #{index + 1}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-orange-500 tracking-wider block">
                  🚀 Live Campus Delivery Tracker
                </span>
                <h3 className="text-lg sm:text-xl font-black">
                  Order #{trackingDetails.order.order_number}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="bg-orange-500/20 text-orange-500 border border-orange-500/30 text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase">
                  {trackingDetails.order.status.replace(/_/g, " ")}
                </span>
                <button
                  onClick={() => selectedTrackingID && handleDismissBanner(selectedTrackingID)}
                  title="Dismiss Banner (Re-open anytime in My Orders)"
                  className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition border border-slate-700/60 shadow-sm"
                >
                  <X className="w-6 h-6 text-orange-500" />
                </button>
              </div>
            </div>

            {/* 1. Live Food Conveyor Belt Animation */}
            <FoodConveyorBelt status={trackingDetails.order.status} theme={theme} />

            {/* 2. Student Delivery Verification Code Box */}
            <StudentVerificationCodeCard
              orderNumber={trackingDetails.order.order_number}
              theme={theme}
            />

            {/* 3. Promotional Campus Offer / Ad Banner */}
            {trackingAd?.is_enabled && trackingAd?.image_url && (
              <div className={`border rounded-2xl overflow-hidden p-3 sm:p-4 space-y-2.5 transition-colors ${
                theme === "dark"
                  ? "bg-slate-950/80 border-indigo-500/40 text-slate-100"
                  : "bg-slate-50 border-indigo-200 text-slate-900 shadow-md"
              }`}>
                <span className="text-[10px] sm:text-[11px] font-black text-indigo-500 uppercase tracking-wider block">
                  📢 Campus Special Offer & Announcement
                </span>
                <img
                  src={trackingAd.image_url}
                  alt="Campus Ad"
                  className="w-full max-h-[350px] rounded-xl border border-slate-700/60 shadow-lg object-contain"
                />
              </div>
            )}

            {/* 4. Step-by-Step Timeline & Delivery Destination */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                { label: "Confirmed", active: true },
                {
                  label: "Preparing",
                  active: ["preparing", "packed", "assigned", "out_for_delivery", "delivered"].includes(
                    trackingDetails.order.status
                  ),
                },
                {
                  label: "Out for Delivery",
                  active: ["out_for_delivery", "delivered"].includes(trackingDetails.order.status),
                },
                {
                  label: "Delivered",
                  active: trackingDetails.order.status === "delivered",
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border text-[11px] sm:text-xs font-bold ${step.active
                    ? "bg-orange-500/15 border-orange-500/40 text-orange-500"
                    : "bg-slate-950/50 border-slate-800 text-slate-500"
                    }`}
                >
                  {step.label}
                </div>
              ))}
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-slate-400 space-y-1">
              <div>
                Delivering to: <span className="text-white font-bold">{trackingDetails.order.building}, Floor {trackingDetails.order.floor}, Room {trackingDetails.order.room_number}</span>
              </div>
              <div>Estimated Delivery: <span className="text-orange-400 font-bold">15–20 mins</span></div>
            </div>
          </div>
        </section>
      )}

      {/* Header & Fixed/Sticky Top Bar */}
      <header
        style={{
          position: hasActiveTracker ? "sticky" : "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
        }}
        className={`border-b shadow-md transition-colors duration-300 ${
          theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

          {/* Logo & Platform Tagline */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-md shadow-orange-500/20 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className={`font-extrabold text-lg tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                  Campus Bites
                </span>
              </div>
              <p className={`text-[11px] hidden sm:block font-medium ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                Everything You Crave, Delivered to Your Floor
              </p>
            </div>
          </div>

          {/* Header Top Bar Controls */}
          <div className="flex items-center space-x-2">
            {/* Delivery Location Indicator */}
            <button
              onClick={() => setShowAddressModal(true)}
              className={`border rounded-xl px-2.5 py-1.5 text-xs flex items-center space-x-1.5 transition ${theme === "dark"
                ? "bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200"
                : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900 shadow-sm"
                }`}
            >
              <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className={`font-bold text-xs truncate max-w-[110px] sm:max-w-none ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>
                {roomNumber ? `${building} R-${roomNumber}` : "Set Location"}
              </span>
            </button>

            {/* Desktop-only action buttons */}
            <div className="hidden sm:flex items-center space-x-2">
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-orange-500/20 transition active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>₹{getSubtotal()}</span>
                {getCartItemCount() > 0 && (
                  <span className="bg-slate-950 text-orange-400 font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center ml-1">
                    {getCartItemCount()}
                  </span>
                )}
              </button>

              {isLoggedIn && (
                <>
                  <button
                    onClick={() => {
                      fetchOrderHistory();
                      setShowHistoryModal(true);
                    }}
                    title="My Orders & Reviews"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center space-x-1.5"
                  >
                    <Clock className="w-4 h-4 text-orange-400" />
                    <span>My Orders</span>
                  </button>
                  <button
                    onClick={() => setShowPrintingsModal(true)}
                    title="Printings"
                    className="bg-orange-500 hover:bg-orange-600 text-slate-950 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-orange-500/20"
                  >
                    <AnimatedPrinterIcon className="w-4 h-4" />
                    <span>Printings</span>
                  </button>
                </>
              )}
            </div>

            {/* Light / Dark Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
              className={
                theme === "dark"
                  ? "bg-slate-800 hover:bg-slate-700 text-amber-400 p-2 rounded-xl transition"
                  : "bg-slate-200 hover:bg-slate-300 text-amber-600 p-2 rounded-xl transition border border-slate-300"
              }
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Profile / Account Trigger */}
            {isLoggedIn ? (
              <button
                onClick={() => setShowAccountDrawer(true)}
                title="Account Menu"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl transition flex items-center space-x-1"
              >
                <User className="w-4 h-4 text-orange-400" />
              </button>
            ) : (
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition"
              >
                Login
              </button>
            )}
          </div>
        </div>

        {/* Mobile Primary Navigation Bar (2-Row Layout Directly Below Title for < sm screens) */}
        <div className={`sm:hidden border-t px-3 py-2 space-y-1.5 transition-colors duration-300 ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={scrollToMenu}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 border transition active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850"
                  : "bg-white border-slate-300 text-slate-900 shadow-sm"
              }`}
            >
              <Utensils className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Home</span>
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1 shadow-md transition active:scale-95"
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span>Cart ({getCartItemCount()})</span>
            </button>

            <button
              onClick={() => {
                if (isLoggedIn) {
                  fetchOrderHistory();
                  setShowHistoryModal(true);
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 border transition active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850"
                  : "bg-white border-slate-300 text-slate-900 shadow-sm"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Orders</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setShowPrintingsModal(true)}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 border transition active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850"
                  : "bg-white border-slate-300 text-slate-900 shadow-sm"
              }`}
            >
              <AnimatedPrinterIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Printings</span>
            </button>

            <button
              onClick={() => {
                if (isLoggedIn) {
                  setShowAccountDrawer(true);
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 border transition active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-850"
                  : "bg-white border-slate-300 text-slate-900 shadow-sm"
              }`}
            >
              <User className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="truncate">{isLoggedIn ? (profile?.short_name || "Account") : "Login"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero & Food Positioning Banner */}
      <section className={`relative overflow-hidden border-b px-4 pb-8 md:pb-12 transition-colors duration-300 ${
        hasActiveTracker
          ? "pt-6 sm:pt-8"
          : "pt-[140px] sm:pt-[84px]"
      } ${
        theme === "dark"
          ? "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-slate-800/80"
          : "bg-gradient-to-b from-orange-50/80 via-white to-slate-50 border-slate-200"
      }`}>
        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center space-x-2 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 px-3.5 py-1.5 rounded-full text-xs font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>Made for students • Delivered inside campus</span>
          </motion.div>

          <h1 className={`text-3xl md:text-5xl font-black tracking-tight leading-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
            {timeGreeting.title}
          </h1>

          <p className={`text-base md:text-lg max-w-2xl mx-auto font-normal leading-relaxed ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
            {timeGreeting.subtitle}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
            {[
              { label: "🍳 Breakfast", cat: "breakfast" },
              { label: "🍗 Biryani", cat: "biryani" },
              { label: "🍲 Meals", cat: "meals" },
              { label: "🍔 Fast Food", cat: "fast food" },
              { label: "🍿 Snacks", cat: "snacks" },
              { label: "🥤 Drinks", cat: "beverages" },
              { label: "🖨️ Printing", cat: "printing" },
            ].map((item) => (
              <button
                key={item.cat}
                onClick={() => {
                  if (item.cat === "printing") {
                    setShowPrintingsModal(true);
                  } else {
                    setSelectedCategory(item.cat);
                    scrollToMenu();
                  }
                }}
                className={`border px-3 py-1 rounded-lg transition font-medium cursor-pointer ${theme === "dark"
                  ? "bg-slate-800/80 hover:bg-orange-500 hover:text-slate-950 border-slate-700/60 text-slate-300"
                  : "bg-white hover:bg-orange-500 hover:text-white border-slate-300 text-slate-800 shadow-sm"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>



          <div className="flex items-center justify-center space-x-3 pt-3">
            <button
              onClick={scrollToMenu}
              className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm flex items-center space-x-2 shadow-lg shadow-orange-500/25 transition"
            >
              <span>Order Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSelectedCategory(timeGreeting.categoryId);
                scrollToMenu();
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-3 rounded-xl text-sm border border-slate-700 transition"
            >
              {timeGreeting.buttonText}
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {networkError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Connecting to CampusBites backend at <strong>http://localhost:8080</strong>... Make sure Go server is running!</span>
            </div>
            <button
              onClick={() => {
                loadMenu();
                fetchDeliverySlots();
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-xl transition shrink-0"
            >
              Retry Connection
            </button>
          </div>
        )}


        {/* Authentication Modal / Card if not logged in */}
        {!isLoggedIn && (
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg mx-auto shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-white">Student Login</h2>
              <p className="text-xs text-slate-400">
                Enter your mobile number to view saved orders & floor delivery
              </p>
            </div>

            {!isRegistering ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="9876543210"
                    required
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl text-slate-100 text-sm outline-none transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoginLoading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold py-3 rounded-xl flex items-center justify-center space-x-2 text-sm transition"
                >
                  {isLoginLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Continue with Mobile</span>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Short Name
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Sameer Sharma"
                    required
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl text-slate-100 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Roll Number
                  </label>
                  <input
                    type="text"
                    value={regRoll}
                    onChange={(e) => setRegRoll(e.target.value)}
                    placeholder="2026CS101"
                    required
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl text-slate-100 text-sm outline-none"
                  />
                </div>
                <div className="bg-slate-950 border border-dashed border-slate-800 rounded-2xl p-4 text-center space-y-3">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                    ID Card Verification Document
                  </span>
                  {regIDUrl && (
                    <div className="h-24 bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                      <img src={regIDUrl} alt="ID" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl text-xs flex items-center justify-center space-x-2"
                  >
                    <span>📷 Scan ID (Live Camera)</span>
                  </button>
                </div>
                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="w-1/3 bg-slate-800 text-slate-400 py-2.5 rounded-xl font-bold text-xs"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoginLoading || !regIDUrl}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold py-2.5 rounded-xl text-xs disabled:opacity-40"
                  >
                    Verify & Create Profile
                  </button>
                </div>
              </form>
            )}
          </section>
        )}



        {/* Reorder Section ("Order Again") if user has past history */}
        {pastOrderedProducts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center space-x-2">
              <RotateCcw className="w-4 h-4 text-orange-400" />
              <h2 className="text-lg font-extrabold text-white">🔄 Order Again</h2>
            </div>
            <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-none">
              {pastOrderedProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-3 min-w-[200px] max-w-[220px] shrink-0 space-y-2 flex flex-col justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={prod.image_url || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=150&q=80"}
                      alt={prod.name}
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{prod.name}</h4>
                      <p className="text-xs font-semibold text-orange-400">₹{prod.selling_price}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart(prod.id)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-1.5 rounded-xl transition"
                  >
                    + Add to Cart
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Dynamic Time-Based Discovery Section */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xl">{timeGreeting.title.split(" ").slice(-1)[0]}</span>
              <div>
                <h3 className="text-lg font-bold text-white">{timeGreeting.period} Highlights</h3>
                <p className="text-xs text-slate-400">{timeGreeting.subtitle}</p>
              </div>
            </div>
            <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[11px] font-bold px-3 py-1 rounded-full hidden sm:block">
              {timeGreeting.tag}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
            {timeHighlights.map((item) => (

              <div
                key={item.id}
                className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-3 space-y-3 transition flex flex-col justify-between group"
              >
                <div className="relative h-28 rounded-xl overflow-hidden bg-slate-900">
                  <img
                    src={item.image_url || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80"}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  {item.mrp > item.selling_price && (
                    <span className="absolute top-2 left-2 bg-orange-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      {Math.round(((item.mrp - item.selling_price) / item.mrp) * 100)}% OFF
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white line-clamp-1">{item.name}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm font-extrabold text-orange-400">₹{item.selling_price}</span>
                    {item.mrp > item.selling_price && (
                      <span className="text-xs text-slate-500 line-through">₹{item.mrp}</span>
                    )}
                  </div>
                </div>

                {cart[item.id] ? (
                  <div className="flex items-center justify-between bg-orange-500 text-slate-950 rounded-xl p-1 font-bold text-xs">
                    <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 flex items-center justify-center hover:bg-orange-600 rounded-lg">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span>{cart[item.id]}</span>
                    <button onClick={() => addToCart(item.id)} className="w-7 h-7 flex items-center justify-center hover:bg-orange-600 rounded-lg">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(item.id)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl text-xs transition"
                  >
                    + Add
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Search Experience & Quick Suggestion Chips */}
        <section className="space-y-4" ref={menuSectionRef}>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chicken biryani, burgers, momos, coffee, maggi, or 'under 50'..."
              className={`w-full pl-12 pr-10 py-3.5 border focus:border-orange-500 rounded-2xl text-sm outline-none transition shadow-inner ${theme === "dark"
                ? "bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500"
                : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 shadow-sm"
                }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Search Chips */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className={`font-bold text-[11px] shrink-0 ${theme === "dark" ? "text-slate-500" : "text-slate-600"}`}>Try searching:</span>
            {[
              "Chicken Biryani",
              "Burger",
              "Momos",
              "Pizza",
              "Maggi",
              "Coffee",
              "Breakfast",
              "Under ₹50",
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => setSearchQuery(chip)}
                className={`border px-3 py-1.5 rounded-full shrink-0 transition font-medium ${theme === "dark"
                  ? "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300"
                  : "bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-sm"
                  }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </section>

        {/* Food Category Navigation */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {foodCategoryList.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2.5 rounded-2xl font-bold text-xs shrink-0 flex items-center space-x-2 border transition ${selectedCategory === cat.id
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 border-orange-400 shadow-md shadow-orange-500/20"
                  : theme === "dark"
                    ? "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                    : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100 shadow-sm"
                  }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}

            {/* Printing Tab Service */}
            <button
              onClick={() => setShowPrintingsModal(true)}
              className="px-4 py-2.5 rounded-2xl font-bold text-xs shrink-0 flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 text-slate-950 transition border border-orange-400 shadow-sm"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>🖨️ Printing Service</span>
            </button>
          </div>
        </section>

        {/* Special Section: 🔥 Popular on Campus */}
        {selectedCategory === "all" && !searchQuery && popularProducts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center space-x-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <h3 className={`text-lg font-extrabold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>🔥 Popular on Campus</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {popularProducts.map((p, idx) => (
                <div
                  key={p.id}
                  className={`border rounded-2xl p-3 flex flex-col justify-between space-y-3 shadow-sm ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                    }`}
                >
                  <div className="relative h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950">
                    <img src={p.image_url || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80"} alt={p.name} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 bg-orange-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {idx === 0 ? "🔥 Bestseller" : idx === 1 ? "⭐ Student Favorite" : idx === 2 ? "⚡ Fast Delivery" : "💰 Best Value"}
                    </span>
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{p.name}</h4>
                    <p className="text-sm font-extrabold text-orange-500 mt-1">₹{p.selling_price}</p>
                  </div>
                  {cart[p.id] ? (
                    <div className="flex items-center justify-between bg-orange-500 text-slate-950 rounded-xl p-1 font-bold text-xs">
                      <button onClick={() => removeFromCart(p.id)} className="w-7 h-7 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                      <span>{cart[p.id]}</span>
                      <button onClick={() => addToCart(p.id)} className="w-7 h-7 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(p.id)}
                      className={`w-full font-bold py-2 rounded-xl text-xs transition ${theme === "dark"
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                        : "bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                        }`}
                    >
                      + Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Special Section: 💰 Student Budget ("Under ₹50") */}
        {selectedCategory === "all" && !searchQuery && budgetProducts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center space-x-2">
              <Tag className="w-5 h-5 text-emerald-500" />
              <h3 className={`text-lg font-extrabold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>💰 Student Budget — Everything under ₹50</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {budgetProducts.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className={`border rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-sm ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                    }`}
                >
                  <h4 className={`text-xs font-bold line-clamp-1 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{p.name}</h4>
                  <p className="text-xs font-extrabold text-emerald-500">₹{p.selling_price}</p>
                  <button
                    onClick={() => addToCart(p.id)}
                    className={`w-full text-xs font-bold py-1.5 rounded-xl transition ${theme === "dark"
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      }`}
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main Product Catalog Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-extrabold capitalize ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
              {selectedCategory === "all" ? "Full Food Menu" : selectedCategory} ({filteredProducts.length})
            </h3>
          </div>

          {menuLoading ? (
            <div className="flex items-center justify-center py-16 space-x-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
              <span>Loading menu items...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={`border rounded-3xl p-12 text-center space-y-3 ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}>
              <Utensils className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>No products found</h4>
              <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Try searching for something else or clearing filters.</p>
              <button
                onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}
                className="bg-orange-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs mt-2"
              >
                Clear Search & Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product: Product) => {
                const isAdded = Boolean(cart[product.id]);
                const qty = cart[product.id] || 0;
                return (
                  <div
                    key={product.id}
                    className={`border rounded-3xl p-4 flex flex-col justify-between space-y-4 transition duration-200 shadow-lg group ${theme === "dark"
                      ? "bg-slate-900 border-slate-800/90 hover:border-slate-700"
                      : "bg-white border-slate-200 hover:border-orange-300 shadow-md"
                      }`}
                  >
                    <div className="relative h-40 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950">
                      <img
                        src={product.image_url || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80"}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      {product.mrp > product.selling_price && (
                        <span className="absolute top-3 left-3 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-full shadow-md">
                          SAVE ₹{Math.round(product.mrp - product.selling_price)}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h4 className={`font-extrabold text-base leading-snug line-clamp-1 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{product.name}</h4>
                      <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>⚡ Hand-delivered in 15–20 mins</p>
                      <div className="flex items-baseline space-x-2 pt-1">
                        <span className="text-lg font-black text-orange-500">₹{product.selling_price}</span>
                        {product.mrp > product.selling_price && (
                          <span className="text-xs text-slate-400 line-through font-semibold">₹{product.mrp}</span>
                        )}
                      </div>
                    </div>

                    {isAdded ? (
                      <div className="flex items-center justify-between bg-orange-500 text-slate-950 rounded-2xl p-1.5 font-black text-sm shadow-md">
                        <button
                          onClick={() => removeFromCart(product.id)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-orange-600 rounded-xl transition"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span>{qty}</span>
                        <button
                          onClick={() => addToCart(product.id)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-orange-600 rounded-xl transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product.id)}
                        className={`w-full font-bold py-2.5 rounded-2xl text-xs flex items-center justify-center space-x-2 transition border ${theme === "dark"
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700"
                          : "bg-orange-500 hover:bg-orange-600 text-white border-orange-500 shadow-md"
                          }`}
                      >
                        <Plus className="w-4 h-4 text-white" />
                        <span>Add to Cart</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>

      {/* Slide-over Persistent Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[10005] overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              onTouchMove={(e) => e.preventDefault()}
              className={`absolute inset-0 backdrop-blur-sm touch-none transition-colors duration-300 ${
                theme === "dark" ? "bg-slate-950/70" : "bg-slate-900/40"
              }`}
            />

            {/* Cart Drawer Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className={`absolute top-[145px] sm:top-[85px] bottom-3 right-2 sm:right-4 left-auto w-[min(88vw,360px)] max-w-sm border rounded-3xl shadow-2xl flex flex-col overflow-y-auto scrollbar-thin z-50 p-4 space-y-4 transition-colors duration-300 ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {/* Cart Drawer Header */}
              <div className={`pb-3 border-b flex items-center justify-between transition-colors ${
                theme === "dark" ? "border-slate-800" : "border-slate-200"
              }`}>
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-5 h-5 text-orange-500" />
                  <h3 className={`text-base font-extrabold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Your Campus Cart</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    theme === "dark" ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"
                  }`}>
                    {getCartItemCount()} items
                  </span>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className={`p-1.5 rounded-xl transition ${
                    theme === "dark"
                      ? "text-slate-400 hover:text-white hover:bg-slate-800"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Free Delivery Progress Bar */}
              <div className={`border rounded-2xl p-3 space-y-2 transition-colors ${
                theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex justify-between text-xs font-bold">
                  {getSubtotal() >= freeDeliveryThreshold ? (
                    <span className="text-emerald-500 font-extrabold">🎉 FREE DELIVERY UNLOCKED!</span>
                  ) : (
                    <span className={theme === "dark" ? "text-slate-300" : "text-slate-700"}>
                      🚚 Add ₹{freeDeliveryThreshold - getSubtotal()} more to unlock FREE DELIVERY
                    </span>
                  )}
                  <span className="text-orange-500 font-bold">₹{getSubtotal()} / ₹{freeDeliveryThreshold}</span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${
                  theme === "dark" ? "bg-slate-800" : "bg-slate-200"
                }`}>
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (getSubtotal() / freeDeliveryThreshold) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Saved Address Info inside Cart */}
              <div className={`border rounded-2xl p-3 text-xs space-y-1.5 transition-colors ${
                theme === "dark" ? "bg-slate-950/90 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase font-extrabold tracking-wider flex items-center space-x-1 ${
                    theme === "dark" ? "text-slate-400" : "text-slate-500"
                  }`}>
                    <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span>Floor Corridor Delivery Address</span>
                  </span>
                  <button
                    onClick={() => setShowAddressModal(true)}
                    className="text-orange-500 hover:underline font-bold text-[11px]"
                  >
                    Change Address
                  </button>
                </div>
                <div className={`border rounded-xl p-2.5 grid grid-cols-2 gap-2 text-xs transition-colors ${
                  theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                }`}>
                  <div>
                    <span className={`text-[10px] block ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>Block / Building</span>
                    <span className={`font-bold leading-tight block ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{building || "Main Campus"}</span>
                  </div>
                  <div>
                    <span className={`text-[10px] block ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>Floor & Room</span>
                    <span className="font-extrabold text-orange-500 leading-tight block">
                      Floor {floor} • Room {roomNumber || "Not Set"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Slot Selection */}
              <div className={`border rounded-2xl p-3 transition-colors ${
                theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <label className={`text-xs font-bold block mb-2 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>Select Delivery Slot</label>
                <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {deliverySlots.filter((s) => s.is_active).length > 0 ? (
                    deliverySlots
                      .filter((s) => s.is_active)
                      .map((slot) => {
                        const openSlot = deliverySlots.find((s) => s.is_ordering_open && s.is_active);
                        const isSelected = selectedSlotId === slot.id || (!selectedSlotId && openSlot?.id === slot.id);
                        return (
                          <button
                            key={slot.id}
                            onClick={() => setSelectedSlotId(slot.id)}
                            disabled={!slot.is_ordering_open}
                            className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                              isSelected
                                ? "bg-orange-500 text-white border-orange-500 shadow-md"
                                : slot.is_ordering_open
                                  ? theme === "dark"
                                    ? "bg-slate-900 text-slate-300 border-slate-700 hover:border-orange-500/50"
                                    : "bg-white text-slate-800 border-slate-300 hover:border-orange-500/50 shadow-sm"
                                  : theme === "dark"
                                    ? "bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed"
                                    : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                              }`}
                          >
                            <div className="flex flex-col items-center space-y-0.5">
                              <span>{slot.name}</span>
                              <span className="text-[10px] font-medium opacity-80">
                                {slot.delivery_start} - {slot.delivery_end}
                              </span>
                              <span className={`text-[9px] font-medium ${isSelected ? "text-orange-100" : "text-orange-500"}`}>
                                Order before {slot.order_cutoff}
                              </span>
                            </div>
                          </button>
                        );
                      })
                  ) : (
                    <span className={`text-xs italic ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>No delivery slots available today.</span>
                  )}
                </div>
              </div>
              {getCartItemCount() === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <ShoppingBasket className={`w-12 h-12 mx-auto ${theme === "dark" ? "text-slate-700" : "text-slate-300"}`} />
                  <div>
                    <h4 className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Your cart is hungry!</h4>
                    <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>Discover breakfast, biryani, meals & snacks.</p>
                  </div>
                  <button
                    onClick={scrollToMenu}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition"
                  >
                    Explore Menu
                  </button>
                </div>
              ) : (
                <>
                  {/* Food Items */}
                  {Object.entries(cart).map(([prodId, qty]) => {
                    const prod = products.find((p) => p.id === prodId);
                    if (!prod) return null;
                    return (
                      <div
                        key={prodId}
                        className={`border rounded-2xl p-3 flex items-center justify-between space-x-3 transition-colors ${
                          theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <img
                          src={prod.image_url || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=150&q=80"}
                          alt={prod.name}
                          className="w-14 h-14 rounded-xl object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className={`text-xs font-bold truncate ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{prod.name}</h5>
                          <p className="text-xs font-extrabold text-orange-500">₹{prod.selling_price * qty}</p>
                        </div>
                        <div className={`flex items-center space-x-2 border rounded-xl p-1 transition-colors ${
                          theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                        }`}>
                          <button onClick={() => removeFromCart(prodId)} className={`w-6 h-6 flex items-center justify-center transition ${
                            theme === "dark" ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
                          }`}>
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className={`text-xs font-bold px-1 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{qty}</span>
                          <button onClick={() => addToCart(prodId)} className={`w-6 h-6 flex items-center justify-center transition ${
                            theme === "dark" ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
                          }`}>
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button onClick={() => deleteItemFromCart(prodId)} className="text-slate-400 hover:text-red-500 p-1 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Print Jobs */}
                  {printJobs.map((job) => (
                    <div
                      key={job.localId}
                      className={`border rounded-2xl p-3 flex items-center justify-between space-x-3 transition-colors ${
                        theme === "dark" ? "bg-indigo-950/40 border-indigo-800/80" : "bg-indigo-50/70 border-indigo-200"
                      }`}
                    >
                      <Printer className="w-8 h-8 text-indigo-500 shrink-0" />
                      <div className="flex-1 min-w-0 text-xs">
                        <h5 className={`font-bold truncate ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{job.file_name}</h5>
                        <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                          {job.page_count} pages • {job.color_mode.toUpperCase()} • {job.copies} copies
                        </p>
                        <p className={`font-extrabold ${theme === "dark" ? "text-indigo-300" : "text-indigo-600"}`}>₹{job.line_total}</p>
                      </div>
                      <button onClick={() => removePrintJob(job.localId)} className="text-slate-400 hover:text-red-500 p-1 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Recommendations inside Cart ("Complete your meal") */}
                  <div className={`pt-4 border-t space-y-3 transition-colors ${theme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
                    <h5 className={`text-xs font-extrabold flex items-center space-x-1 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                      <span>Complete your meal 😋</span>
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      {products.slice(0, 2).map((rec) => (
                        <div key={rec.id} className={`border rounded-xl p-2 flex items-center justify-between text-xs transition-colors ${
                          theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                        }`}>
                          <div className="truncate pr-1">
                            <span className={`font-bold block truncate ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{rec.name}</span>
                            <span className="text-orange-500 font-bold">₹{rec.selling_price}</span>
                          </div>
                          <button
                            onClick={() => addToCart(rec.id)}
                            className={`font-bold text-[10px] px-2 py-1 rounded-lg shrink-0 transition ${
                              theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                            }`}
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Cart Drawer Footer & Checkout */}
              {getCartItemCount() > 0 && (
                <div className={`p-5 border-t rounded-2xl space-y-3 transition-colors ${
                  theme === "dark" ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
                }`}>
                  <div className="space-y-1.5 text-xs">
                    <div className={`flex justify-between ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      <span>Subtotal</span>
                      <span>₹{getSubtotal()}</span>
                    </div>
                    <div className={`flex justify-between ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      <span>Corridor Delivery Fee</span>
                      <span>{currentDeliveryFee === 0 ? "FREE" : `₹${currentDeliveryFee}`}</span>
                    </div>

                    <div className={`flex justify-between text-base font-extrabold pt-2 border-t transition-colors ${
                      theme === "dark" ? "text-white border-slate-800" : "text-slate-900 border-slate-200"
                    }`}>
                      <span>Total Amount</span>
                      <span className="text-orange-500">₹{getFinalTotal()}</span>
                    </div>
                  </div>

                  {/* Cutoff / Maintenance Warning Banner above Proceed to Pay */}
                  {is0001CutoffMode ? (
                    <div className={`p-4 border rounded-2xl text-center space-y-2 shadow-xl backdrop-blur-sm transition-colors ${
                      theme === "dark"
                        ? "bg-gradient-to-br from-orange-950/80 via-amber-950/70 to-slate-900 border-orange-500/40"
                        : "bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100/50 border-orange-300"
                    }`}>
                      <div className="font-black text-sm text-orange-500 flex items-center justify-center gap-1.5">
                        <span>🚀 Something BIG is Cooking!</span>
                      </div>
                      <p className={`text-xs font-medium leading-relaxed ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}>
                        We&apos;re taking a short break today to bring you something even better.
                        <br />
                        CampusBites will be back tomorrow! ❤️
                      </p>
                      <p className="text-[11px] text-amber-500 font-bold italic pt-0.5">
                        Stay tuned — we&apos;ve got something special coming your way. 🔥
                      </p>
                    </div>
                  ) : isOrderingClosed ? (
                    <div className={`p-3.5 border rounded-2xl text-center shadow-lg transition-colors ${
                      theme === "dark"
                        ? "bg-red-950/60 border-red-500/40 text-red-300"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}>
                      <span className="text-xs font-bold block leading-relaxed">
                        🌙 Ordering is closed right now! All delivery slots for today have passed their cutoff time. Please check back tomorrow morning.
                      </span>
                    </div>
                  ) : null}

                  <div className="flex space-x-2">
                    <button
                      onClick={scrollToMenu}
                      className={`w-1/2 font-bold py-3 rounded-xl text-xs border transition ${
                        theme === "dark"
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                          : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                    >
                      + Add More Items
                    </button>
                    <button
                      onClick={handleCheckout}
                      disabled={checkoutLoading || is0001CutoffMode || isOrderingClosed}
                      className={`w-1/2 font-extrabold py-3 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg transition ${
                        is0001CutoffMode || isOrderingClosed
                          ? theme === "dark"
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                          : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                      }`}
                    >
                      {checkoutLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>Proceed to Pay</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saved Location Modal */}
      <AnimatePresence>
        {showAddressModal && (
          <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddressModal(false)}
              className={`absolute inset-0 backdrop-blur-sm transition-colors duration-300 ${
                theme === "dark" ? "bg-slate-950/80" : "bg-slate-900/40"
              }`}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative max-w-sm w-full rounded-3xl p-4 md:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto border z-10 transition-colors ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-center">
                <h3 className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Saved Delivery Location</h3>
                <button
                  onClick={() => setShowAddressModal(false)}
                  className={`p-1 rounded-lg transition ${theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className={`block font-bold mb-1 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Building / Hostel Block</label>
                  <select
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2.5 outline-none border transition ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 text-slate-100"
                        : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                  >
                    <option value="N Block">N Block</option>
                    <option value="A Block">A Block</option>
                    <option value="H Block">H Block</option>
                    <option value="U Block">U Block</option>
                    <option value="Lara">Lara</option>
                    <option value="Pharmacy">Pharmacy</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Floor Number</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={floor}
                    onChange={(e) => setFloor(parseInt(e.target.value, 10) || 0)}
                    className={`w-full rounded-xl px-3 py-2.5 outline-none border transition ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 text-slate-100"
                        : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Room Number</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="501"
                    className={`w-full rounded-xl px-3 py-2.5 outline-none border transition ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 text-slate-100"
                        : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <button
                onClick={() => saveDeliveryAddress(building, floor, roomNumber)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition"
              >
                Save Delivery Location
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printing Modal */}
      <AnimatePresence>
        {showPrintingsModal && (
          <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPrintingsModal(false)}
              className={`absolute inset-0 backdrop-blur-sm transition-colors duration-300 ${
                theme === "dark" ? "bg-slate-950/80" : "bg-slate-900/40"
              }`}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative max-w-lg w-full rounded-3xl p-4 md:p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto border z-10 transition-colors ${
                theme === "dark"
                  ? "bg-slate-900 border-indigo-900/60 text-slate-100"
                  : "bg-white border-indigo-100 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Printer className="w-5 h-5 text-indigo-500" />
                  <h3 className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Campus Printing Service</h3>
                </div>
                <button
                  onClick={() => setShowPrintingsModal(false)}
                  className={`p-1 rounded-lg transition ${theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className={`border rounded-2xl p-4 text-center space-y-2 transition-colors ${
                  theme === "dark"
                    ? "bg-indigo-950/40 border-indigo-800/60"
                    : "bg-indigo-50/70 border-indigo-200"
                }`}>
                  <p className={`font-bold ${theme === "dark" ? "text-indigo-300" : "text-indigo-700"}`}>Upload PDF or Document File</p>
                  <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={handlePrintFilesSelected}
                    className={`block w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer ${
                      theme === "dark" ? "text-slate-400" : "text-slate-600"
                    }`}
                  />
                  {printUploading && (
                    <div className="flex items-center justify-center space-x-2 text-indigo-500 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing file & calculating pages...</span>
                    </div>
                  )}
                </div>

                {printDraftFiles.length > 0 && (
                  <div className="space-y-2">
                    {printDraftFiles.map((file, idx) => (
                      <div key={idx} className={`border rounded-xl p-2.5 flex justify-between items-center text-xs transition-colors ${
                        theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                      }`}>
                        <span className={`font-bold truncate max-w-[200px] ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>{file.file_name}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          theme === "dark" ? "bg-indigo-950 text-indigo-300" : "bg-indigo-100 text-indigo-800"
                        }`}>
                          {file.page_count} Pages
                        </span>
                      </div>
                    ))}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className={`block font-bold mb-1 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Color Mode</label>
                        <select
                          value={printColorMode}
                          onChange={(e) => setPrintColorMode(e.target.value as PrintColorMode)}
                          className={`w-full rounded-xl px-3 py-2 border transition ${
                            theme === "dark"
                              ? "bg-slate-950 border-slate-800 text-slate-200"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          }`}
                        >
                          <option value="bw">B&W (Black & White)</option>
                          <option value="color">Color</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block font-bold mb-1 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Sides</label>
                        <select
                          value={printSides}
                          onChange={(e) => setPrintSides(e.target.value as PrintSides)}
                          className={`w-full rounded-xl px-3 py-2 border transition ${
                            theme === "dark"
                              ? "bg-slate-950 border-slate-800 text-slate-200"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          }`}
                        >
                          <option value="single">Single Sided</option>
                          <option value="double">Double Sided</option>
                        </select>
                      </div>
                    </div>

                    <div className={`pt-2 flex justify-between items-center border-t transition-colors ${
                      theme === "dark" ? "border-slate-800" : "border-slate-200"
                    }`}>
                      <span className={`font-bold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>Total Print Price:</span>
                      <span className="text-lg font-black text-indigo-500">₹{getPrintPreviewTotal()}</span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={addPrintJobsToCart}
                disabled={printDraftFiles.length === 0 || printUploading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs disabled:opacity-40 shadow-md transition"
              >
                Add Print Jobs to Cart
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order History & Ratings/Reviews Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className={`absolute inset-0 backdrop-blur-sm transition-colors duration-300 ${
                theme === "dark" ? "bg-slate-950/80" : "bg-slate-900/40"
              }`}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative max-w-2xl w-full rounded-3xl p-4 md:p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col border z-10 transition-colors ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className={`flex justify-between items-center border-b pb-3 transition-colors ${
                theme === "dark" ? "border-slate-800" : "border-slate-200"
              }`}>
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <h3 className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Order History & Reviews</h3>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  title="Close Order History Modal"
                  className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30 px-3 py-1.5 rounded-xl transition font-black flex items-center space-x-1"
                >
                  <X className="w-5 h-5" />
                  <span className="text-xs font-bold">Close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {orderHistory.length === 0 ? (
                  <div className={`text-center py-10 text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                    No past orders found. Start ordering from the menu!
                  </div>
                ) : (
                  orderHistory.map((ord) => (
                    <div key={ord.id} className={`border rounded-2xl p-4 space-y-3 transition-colors ${
                      theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-extrabold text-orange-500 uppercase tracking-wider block">
                            Order #{ord.order_number}
                          </span>
                          <span className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                            {new Date(ord.created_at).toLocaleString()}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                          theme === "dark"
                            ? "bg-slate-800 text-slate-300 border-slate-700"
                            : "bg-slate-200 text-slate-700 border-slate-300"
                        }`}>
                          {ord.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Active Live Conveyor Belt & Verification Action */}
                      {ord.status !== "delivered" && ord.status !== "cancelled" && ord.status !== "out_of_stock" && (
                        <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 p-2.5 rounded-xl">
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                            </span>
                            <span className="font-bold text-orange-400 text-xs">Active Delivery in Progress</span>
                          </div>
                          <button
                            onClick={() => {
                              setDismissedBannerIDs((prev) => {
                                const updated = prev.filter((id) => id !== ord.id);
                                if (typeof window !== "undefined") {
                                  localStorage.setItem("dismissed_tracking_banner_ids", JSON.stringify(updated));
                                }
                                return updated;
                              });
                              setSelectedTrackingID(ord.id);
                              setActiveOrderIDs((prev) => Array.from(new Set([...prev, ord.id])));
                              setShowHistoryModal(false);
                              setEnlargedTrackingOrderID(null);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-md hover:from-orange-600 hover:to-amber-600 transition flex items-center space-x-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>🍿 View Live Belt & PIN</span>
                          </button>
                        </div>
                      )}
                      {/* Structured Delivery Location Card */}
                      <div className={`border rounded-xl p-2.5 text-xs space-y-1 transition-colors ${
                        theme === "dark" ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200"
                      }`}>
                        <div className={`flex items-center justify-between text-[9px] font-bold uppercase tracking-wider ${
                          theme === "dark" ? "text-slate-400" : "text-slate-500"
                        }`}>
                          <span>Delivery Destination</span>
                          <span>Floor {ord.floor}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className={`text-[9px] block ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>Hostel Block</span>
                            <span className={`font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{ord.building}</span>
                          </div>
                          <div>
                            <span className={`text-[9px] block ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>Room Number</span>
                            <span className="font-bold text-orange-500">Room {ord.room_number}</span>
                          </div>
                        </div>
                      </div>

                      <div className={`text-xs space-y-1 p-2.5 rounded-xl border transition-colors ${
                        theme === "dark"
                          ? "bg-slate-900/60 border-slate-800 text-slate-300"
                          : "bg-white border-slate-200 text-slate-700"
                      }`}>
                        {ord.items && ord.items.map((it: any, i: number) => (
                          <div key={i} className="flex justify-between">
                            <span>{it.quantity}x {it.product_name || "Food Item"}</span>
                            <span className={`font-bold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>₹{it.price * it.quantity}</span>
                          </div>
                        ))}
                        <div className={`pt-1.5 border-t flex justify-between font-extrabold ${
                          theme === "dark" ? "border-slate-800 text-white" : "border-slate-200 text-slate-900"
                        }`}>
                          <span>Total Amount</span>
                          <span className="text-orange-500">₹{ord.total_amount}</span>
                        </div>
                      </div>

                      {/* Rating & Review Action */}
                      {ord.status === "delivered" && (
                        <div className="pt-1 flex items-center justify-between">
                          <span className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>Feedback:</span>
                          <button
                            onClick={() => {
                              setRatingModalOrderID(ord.id);
                              setReviewRating(5);
                              setReviewText("");
                            }}
                            className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30 text-xs font-bold px-3 py-1 rounded-xl transition flex items-center space-x-1"
                          >
                            <span>⭐ Rate & Review Order</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1-5 Star Review Submission Modal */}
      <AnimatePresence>
        {ratingModalOrderID && (
          <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRatingModalOrderID(null)}
              className={`absolute inset-0 backdrop-blur-sm transition-colors duration-300 ${
                theme === "dark" ? "bg-slate-950/85" : "bg-slate-900/40"
              }`}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative max-w-sm w-full rounded-3xl p-4 md:p-6 space-y-4 shadow-2xl text-center max-h-[90vh] overflow-y-auto border z-10 transition-colors ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-100"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <h3 className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Rate your Meal Experience</h3>
              <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>How was your CampusBites food & floor delivery?</p>

              {/* Star Selector */}
              <div className="flex justify-center space-x-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="text-2xl transition transform hover:scale-125"
                  >
                    {star <= reviewRating ? "⭐" : "☆"}
                  </button>
                ))}
              </div>

              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Write your review here (optional)..."
                className={`w-full rounded-xl p-3 text-xs outline-none h-24 resize-none border transition ${
                  theme === "dark"
                    ? "bg-slate-950 border-slate-800 text-slate-100"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                }`}
              />

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setRatingModalOrderID(null)}
                  className={`w-1/3 font-bold py-2.5 rounded-xl text-xs border transition ${
                    theme === "dark"
                      ? "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reviewSubmitting}
                  onClick={async () => {
                    if (!ratingModalOrderID) return;
                    try {
                      setReviewSubmitting(true);
                      await studentApi.submitReview(ratingModalOrderID, reviewRating, reviewText);
                      alert("Thank you for your rating & review! 🌟");
                      setRatingModalOrderID(null);
                      fetchOrderHistory();
                    } catch (e: any) {
                      alert("Failed to submit review: " + e.message);
                    } finally {
                      setReviewSubmitting(false);
                    }
                  }}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition"
                >
                  {reviewSubmitting ? "Submitting..." : "Submit Rating"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enlarged Active Order Tracker Modal */}
      <AnimatePresence>
        {enlargedTrackingOrderID && (
          <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEnlargedTrackingOrderID(null)}
              className={`absolute inset-0 backdrop-blur-md transition-colors duration-300 ${
                theme === "dark" ? "bg-slate-950/85" : "bg-slate-900/60"
              }`}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-xl w-full rounded-3xl p-5 md:p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto border z-10 bg-slate-900 border-slate-800 text-slate-100"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider block">
                    🍿 Live Food Conveyor Belt Tracker
                  </span>
                  <h3 className="text-xl font-black text-white">
                    Order #{enlargedTrackingDetails?.order?.order_number || "..."}
                  </h3>
                </div>
                <button
                  onClick={() => setEnlargedTrackingOrderID(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {enlargedTrackingDetails ? (
                <>
                  {/* 1. Live Food Conveyor Belt Component (Only for Present/Active Orders) */}
                  {enlargedTrackingDetails.order.status !== "delivered" &&
                    enlargedTrackingDetails.order.status !== "cancelled" &&
                    enlargedTrackingDetails.order.status !== "out_of_stock" && (
                      <FoodConveyorBelt
                        status={enlargedTrackingDetails.order.status}
                        theme={theme}
                        isEnlarged={true}
                      />
                    )}

                  {/* 2. Step-by-Step Tracking Timeline */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    {[
                      { label: "Confirmed", active: true },
                      {
                        label: "Cooking",
                        active: ["preparing", "packed", "assigned", "out_for_delivery", "delivered"].includes(
                          enlargedTrackingDetails.order.status
                        ),
                      },
                      {
                        label: "Out for Delivery",
                        active: ["out_for_delivery", "delivered"].includes(enlargedTrackingDetails.order.status),
                      },
                      {
                        label: "Delivered",
                        active: enlargedTrackingDetails.order.status === "delivered",
                      },
                    ].map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs font-bold ${
                          step.active
                            ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                            : "bg-slate-950 border-slate-800 text-slate-600"
                        }`}
                      >
                        {step.label}
                      </div>
                    ))}
                  </div>

                  {/* 3. Delivery Details & Delivery Partner */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Delivery Destination:</span>
                      <span className="font-bold text-white">
                        {enlargedTrackingDetails.order.building}, Floor {enlargedTrackingDetails.order.floor}, Room {enlargedTrackingDetails.order.room_number}
                      </span>
                    </div>
                    {enlargedTrackingDetails.delivery_partner && (
                      <div className="flex justify-between items-center border-t border-slate-800/80 pt-2">
                        <span className="text-slate-400">Delivery Agent:</span>
                        <span className="font-bold text-orange-400">
                          {enlargedTrackingDetails.delivery_partner.name} ({enlargedTrackingDetails.delivery_partner.phone})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 4. Promotional Ad Banner (Full Resolution & Display Size) */}
                  {trackingAd?.is_enabled && trackingAd?.image_url && (
                    <div className="border border-indigo-500/40 rounded-2xl overflow-hidden bg-slate-950 p-4 space-y-3">
                      <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider block">
                        📢 Campus Special Offer & Announcement
                      </span>
                      <img
                        src={trackingAd.image_url}
                        alt="Campus Ad"
                        className="w-full max-h-none object-contain rounded-xl border border-slate-800 shadow-lg"
                      />
                    </div>
                  )}

                  {/* 5. Verification Code Box (Only for Present/Active Orders) */}
                  {enlargedTrackingDetails.order.status !== "delivered" &&
                    enlargedTrackingDetails.order.status !== "cancelled" &&
                    enlargedTrackingDetails.order.status !== "out_of_stock" && (
                      <StudentVerificationCodeCard
                        orderNumber={enlargedTrackingDetails.order.order_number}
                        theme={theme}
                      />
                    )}
                </>
              ) : (
                <div className="flex items-center justify-center py-12 space-x-2 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  <span>Loading live conveyor belt & tracking details...</span>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Secondary Actions Account Drawer Modal */}
      <AnimatePresence>
        {showAccountDrawer && (
          <div className="fixed inset-0 z-[10005] overflow-hidden flex items-end sm:items-center justify-center p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAccountDrawer(false)}
              className={`absolute inset-0 backdrop-blur-sm transition-colors duration-300 ${
                theme === "dark" ? "bg-slate-950/80" : "bg-slate-900/40"
              }`}
            />
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-sm border rounded-3xl p-5 shadow-2xl space-y-4 z-10 transition-colors ${
                theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className={`flex items-center justify-between border-b pb-3 transition-colors ${
                theme === "dark" ? "border-slate-800" : "border-slate-200"
              }`}>
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{profile?.short_name || "Student Profile"}</h4>
                    <p className={`text-[11px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>{profile?.mobile_number || "CampusBites Account"}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAccountDrawer(false)}
                  className={`p-1.5 rounded-lg transition ${
                    theme === "dark" ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowAccountDrawer(false);
                    if (selectedTrackingID) {
                      setTrackingMinimized(false);
                    } else {
                      alert("No active delivery tracking right now. Place an order to track in real-time!");
                    }
                  }}
                  className={`w-full border p-3 rounded-2xl text-xs font-bold flex items-center justify-between transition ${
                    theme === "dark"
                      ? "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200"
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
                    <span>Live Order Tracking</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`} />
                </button>

                <button
                  onClick={() => {
                    setShowAccountDrawer(false);
                    toggleTheme();
                  }}
                  className={`w-full border p-3 rounded-2xl text-xs font-bold flex items-center justify-between transition ${
                    theme === "dark"
                      ? "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200"
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-600" />}
                    <span>Theme ({theme === "dark" ? "Dark Mode" : "Light Mode"})</span>
                  </div>
                  <span className="text-[10px] text-orange-500 font-bold uppercase">Toggle</span>
                </button>

                <button
                  onClick={() => {
                    setShowAccountDrawer(false);
                    alert("Support & Helpdesk: Contact CampusBites Canteen Desk at +91 7386055401");
                  }}
                  className={`w-full border p-3 rounded-2xl text-xs font-bold flex items-center justify-between transition ${
                    theme === "dark"
                      ? "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200"
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Headphones className="w-4 h-4 text-orange-500" />
                    <span>Help & Canteen Support</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`} />
                </button>

                <button
                  onClick={() => {
                    setShowAccountDrawer(false);
                    handleLogout();
                  }}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 p-3 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition mt-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout Account</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Support Helpdesk FAB */}
      <div className={`fixed bottom-6 z-50 flex flex-col space-y-4 transition-all duration-300 ${isCartOpen ? "left-6 items-start" : "right-6 items-end"}`}>
        <AnimatePresence>
          {showSupport && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className={`rounded-3xl p-5 shadow-2xl border w-80 origin-bottom-right transition-colors ${theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-900"}`}
            >
              <div className={`flex items-center space-x-3 mb-5 border-b pb-4 ${theme === "dark" ? "border-slate-800" : "border-slate-100"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${theme === "dark" ? "bg-orange-500/20 text-orange-400" : "bg-orange-50 text-orange-500"}`}>
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Support Helpdesk</h3>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>CampusBites Customer Care</p>
                </div>
              </div>

              <div className="space-y-3">
                <a href="mailto:sdsameer1609@gmail.com" className={`flex items-center space-x-4 p-3 rounded-2xl border transition cursor-pointer ${theme === "dark" ? "border-slate-800 hover:border-orange-500/50 hover:bg-orange-500/10" : "border-slate-100 hover:border-orange-200 hover:bg-orange-50/50"}`}>
                  <Mail className={`w-5 h-5 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`} />
                  <div>
                    <p className={`text-[10px] font-bold uppercase ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>Send Email</p>
                    <p className="font-bold text-sm">sdsameer1609@gmail.com</p>
                  </div>
                </a>

                <a href="tel:+917386055404" className={`flex items-center space-x-4 p-3 rounded-2xl border transition cursor-pointer ${theme === "dark" ? "border-slate-800 hover:border-orange-500/50 hover:bg-orange-500/10" : "border-slate-100 hover:border-orange-200 hover:bg-orange-50/50"}`}>
                  <Phone className="w-5 h-5 text-red-500 fill-red-500" />
                  <div>
                    <p className={`text-[10px] font-bold uppercase ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>Call Support</p>
                    <p className="font-bold text-sm">+91 7386055404</p>
                  </div>
                </a>
              </div>

              <p className={`text-center text-[11px] font-medium mt-5 ${theme === "dark" ? "text-slate-500" : "text-slate-500"}`}>
                Contact us for any delivery delay or payment query.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setShowSupport(!showSupport)}
          className="w-14 h-14 bg-orange-500 hover:bg-orange-600 rounded-full shadow-lg shadow-orange-500/40 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          {showSupport ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Headphones className="w-6 h-6 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}

