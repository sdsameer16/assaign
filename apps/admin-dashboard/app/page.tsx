"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Navigation,
  Sparkles,
  Plus,
  Check,
  X,
  Menu,
  RefreshCw,
  Layers,
  ShieldAlert,
  LogOut,
  CheckCircle,
  MapPin,
  Clock,
  Search,
  AlertCircle,
  ChevronRight,
  Eye,
  ListFilter,
  Loader2,
  Bell,
  MessageSquare,
  Printer,
  ImageIcon,
  Sun,
  Moon,
  Calendar,
  GripVertical,
  Trash,
  Trash2,
  FileText,
  Filter,
  Download,
  Truck,
  Building2,
  DollarSign,
  Receipt,
  ExternalLink,
  ChevronDown,
  Hash,
  LayoutGrid,
  List,
} from "lucide-react";
import { adminApi, getToken, getProfile, logout, setSession } from "../lib/api";
import { MenuSchedule } from "@campusbites/types";
import { uploadAdImage } from "../lib/cloudinary";


const getVerificationCode = (orderNumber: string) => {
  if (!orderNumber) return "CB-58926";
  const parts = orderNumber.split("-");
  if (parts.length >= 2 && parts[1]) {
    return `CB-${parts[1]}`;
  }
  return orderNumber.startsWith("CB-") ? orderNumber : `CB-${orderNumber}`;
};

export default function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Active view tab
  const [activeTab, setActiveTab] = useState<
    | "orders"
    | "history"
    | "pickups"
    | "overview"
    | "products"
    | "menu-schedule"
    | "slots"
    | "hostel-blocks"
    | "delivery-config"
    | "print-pricing"
    | "tracking-ad"
    | "students"
    | "partners"
    | "logs"
    | "notifications"
  >("orders");

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [menuSchedules, setMenuSchedules] = useState<MenuSchedule[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [newScheduleStart, setNewScheduleStart] = useState("08:00");
  const [newScheduleEnd, setNewScheduleEnd] = useState("11:00");

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_theme", next);
    }
  };



  // Inspection states
  const [inspectedStudent, setInspectedStudent] = useState<any>(null);
  const [inspectedStudentTab, setInspectedStudentTab] = useState<
    "id_card" | "orders"
  >("id_card");
  const [inspectedPartner, setInspectedPartner] = useState<any>(null);

  // Stats / Metrics
  const [summary, setSummary] = useState<any>({
    total_revenue: 0,
    total_orders: 0,
    avg_order_value: 0,
    verified_students: 0,
    online_partners: 0,
    popular_product: "None",
  });

  // Data lists
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [deliverySlots, setDeliverySlots] = useState<any[]>([]);
  const [slotFormName, setSlotFormName] = useState("Slot - 1");
  const [slotFormStart, setSlotFormStart] = useState("09:55");
  const [slotFormEnd, setSlotFormEnd] = useState("10:10");
  const [slotFormCutoff, setSlotFormCutoff] = useState("09:45");
  const [slotSaving, setSlotSaving] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [hostelBlocks, setHostelBlocks] = useState<any[]>([]);
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockOrder, setNewBlockOrder] = useState("0");
  const [blockSaving, setBlockSaving] = useState(false);

  // Forms and Modals
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [newProductMrp, setNewProductMrp] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductImage, setNewProductImage] = useState(
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300",
  );
  const [productSaving, setProductSaving] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Product edit states
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [editProductName, setEditProductName] = useState("");
  const [editProductCategory, setEditProductCategory] = useState("");
  const [editProductMrp, setEditProductMrp] = useState("");
  const [editProductPrice, setEditProductPrice] = useState("");
  const [editProductImage, setEditProductImage] = useState("");
  const [productUpdating, setProductUpdating] = useState(false);
  const [editProductAvailable, setEditProductAvailable] = useState(true);
  const [cutoffTime, setCutoffTime] = useState("");

  // Print pricing form
  const [printBwSingle, setPrintBwSingle] = useState("2");
  const [printBwDouble, setPrintBwDouble] = useState("3");
  const [printColorSingle, setPrintColorSingle] = useState("8");
  const [printColorDouble, setPrintColorDouble] = useState("10");
  const [printPricingSaving, setPrintPricingSaving] = useState(false);

  // Dynamic delivery config
  const [deliveryFee, setDeliveryFee] = useState("15");
  const [minFreeDeliveryAmount, setMinFreeDeliveryAmount] = useState("100");
  const [deliveryConfigSaving, setDeliveryConfigSaving] = useState(false);

  // Tracking advertisement
  const [trackingAdEnabled, setTrackingAdEnabled] = useState(false);
  const [trackingAdImageUrl, setTrackingAdImageUrl] = useState("");

  const [trackingAdUploading, setTrackingAdUploading] = useState(false);
  const [trackingAdSaving, setTrackingAdSaving] = useState(false);

  // Partner creation Form
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerMobile, setNewPartnerMobile] = useState("");
  const [newPartnerPass, setNewPartnerPass] = useState("");
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [showAddPartner, setShowAddPartner] = useState(false);

  // Notification States
  const [notificationTarget, setNotificationTarget] = useState("ALL");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");
  const [notificationSending, setNotificationSending] = useState(false);

  // Search parameters
  const [studentSearch, setStudentSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

  // Detailed Order Receipt Inspector Modal
  const [inspectedOrder, setInspectedOrder] = useState<any>(null);

  // Dispatch Desk Filters
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState<string>("all");
  const [dispatchBuildingFilter, setDispatchBuildingFilter] = useState<string>("all");
  const [dispatchSlotFilter, setDispatchSlotFilter] = useState<string>("all");

  // Order History Filters
  const [historySearch, setHistorySearch] = useState<string>("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");
  const [historyDateFilter, setHistoryDateFilter] = useState<string>("all");
  const [historyBuildingFilter, setHistoryBuildingFilter] = useState<string>("all");
  const [historySlotFilter, setHistorySlotFilter] = useState<string>("all");
  const [historyCourierFilter, setHistoryCourierFilter] = useState<string>("all");
  const [historyViewMode, setHistoryViewMode] = useState<"table" | "cards">("table");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Loading indicators
  const [dataLoading, setDataLoading] = useState(false);

  // Toast notifications state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    adminApi.getCutoff().then(data => {
      if (data && data.cutoff_time) {
        setCutoffTime(data.cutoff_time);
      }
    }).catch(() => {});

    const savedToken = getToken();
    const savedProfile = getProfile();
    if (savedToken && savedProfile) {
      setToken(savedToken);
      setProfile(savedProfile);
      setIsLoggedIn(true);
      fetchAllData();
    }
  }, []);

  // Poll metrics every 8 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoggedIn) {
      interval = setInterval(() => {
        fetchSummary();
        fetchOrders();
        adminApi.getCutoff().then(data => {
          if (data && data.cutoff_time) {
            setCutoffTime(data.cutoff_time);
          }
        }).catch(() => {});
      }, 8000);
    }
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const fetchSummary = async () => {
    try {
      const data = await adminApi.getSummary();
      setSummary(data);
    } catch (e) {
      console.warn("Backend server connection polling (summary):", e);
    }
  };

  const fetchOrders = async () => {
    try {
      const data = await adminApi.getOrders();
      const validOrders = (data || []).filter((o: any) => o.payment_status === "paid" || o.payment_status === "reconciliation_required");
      setOrders(validOrders);
    } catch (e) {
      console.warn("Backend server connection polling (orders):", e);
    }
  };

  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);

  const fetchMenuSchedules = async () => {
    try {
      const data = await adminApi.getMenuSchedules();
      setMenuSchedules(data || []);
    } catch (e) {
      console.error("Failed to load menu schedules:", e);
    }
  };

  const fetchHostelBlocks = async () => {
    try {
      const data = await adminApi.getHostelBlocks();
      setHostelBlocks(data || []);
    } catch (e) {
      console.warn("Hostel blocks endpoint not active yet on backend:", e);
    }
  };

  const handleCreateHostelBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockName.trim()) return;
    try {
      setBlockSaving(true);
      await adminApi.createHostelBlock({
        name: newBlockName.trim(),
        is_enabled: true,
        display_order: parseInt(newBlockOrder, 10) || 0,
      });
      setNewBlockName("");
      setNewBlockOrder("0");
      showToast("Hostel block created successfully!");
      fetchHostelBlocks();
    } catch (err: any) {
      showToast("Failed to create hostel block: " + err.message, "error");
    } finally {
      setBlockSaving(false);
    }
  };

  const handleToggleHostelBlock = async (id: string) => {
    try {
      await adminApi.toggleHostelBlock(id);
      showToast("Block status updated!");
      fetchHostelBlocks();
    } catch (err: any) {
      showToast("Failed to toggle block status: " + err.message, "error");
    }
  };

  const handleDeleteHostelBlock = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete hostel block "${name}"?`)) return;
    try {
      await adminApi.deleteHostelBlock(id);
      showToast("Hostel block deleted!");
      fetchHostelBlocks();
    } catch (err: any) {
      showToast("Failed to delete block: " + err.message, "error");
    }
  };

  const fetchAllData = async () => {
    try {
      setDataLoading(true);
      await fetchSummary();

      const prodData = await adminApi.getProducts();
      setProducts(prodData || []);

      const catData = await adminApi.getCategories();
      setCategories(catData || []);

      await fetchMenuSchedules();

      try {
        const slotData = await adminApi.getDeliverySlots();
        setDeliverySlots(slotData || []);
      } catch (e) {
        console.error("Failed to load delivery slots:", e);
      }

      await fetchHostelBlocks();


      try {
        const pricing = await adminApi.getPrintPricing();
        setPrintBwSingle(String(pricing.bw_single));
        setPrintBwDouble(String(pricing.bw_double));
        setPrintColorSingle(String(pricing.color_single));
        setPrintColorDouble(String(pricing.color_double));
      } catch (e) {
        console.error("Failed to load print pricing:", e);
      }

      try {
        const config = await adminApi.getDeliveryConfig();
        setDeliveryFee(String(config.delivery_fee));
        setMinFreeDeliveryAmount(String(config.min_free_delivery_amount));
      } catch (e) {
        console.error("Failed to load delivery config:", e);
      }


      try {
        const ad = await adminApi.getTrackingAd();
        setTrackingAdEnabled(Boolean(ad.is_enabled));
        setTrackingAdImageUrl(ad.image_url || "");
      } catch (e) {
        console.error("Failed to load tracking ad:", e);
      }

      try {
        const studentData = await adminApi.getStudents();
        setStudents(studentData || []);
      } catch (e) {
        console.error("Failed to load students:", e);
      }

      try {
        const partnerData = await adminApi.getPartners();
        setPartners(partnerData || []);
      } catch (e) {
        console.error("Failed to load delivery partners:", e);
      }

      try {
        await fetchOrders();
      } catch (e) {
        console.error("Failed to load orders:", e);
      }

      try {
        const logData = await adminApi.getAuditLogs();
        setAuditLogs(logData || []);
      } catch (e) {
        console.error("Failed to load audit logs:", e);
      }

      // Fetch cutoff time config
      try {
        const cutoffData = await adminApi.getCutoff();
        if (cutoffData && cutoffData.cutoff_time) {
          setCutoffTime(cutoffData.cutoff_time);
        }
      } catch (err) {
        console.error("Failed to get cutoff config:", err);
      }
    } catch (e) {
      console.error("Error fetching admin data:", e);
    } finally {
      setDataLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      setLoginLoading(true);
      const data = await adminApi.login(email, password);
      if (data.token && data.admin) {
        setSession(data.token, data.admin);
        setToken(data.token);
        setProfile(data.admin);
        setIsLoggedIn(true);
        fetchAllData();
        showToast("Successfully authenticated.", "success");
      }
    } catch (err: any) {
      showToast("Authentication failed: " + err.message, "error");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setToken(null);
    setProfile(null);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductPrice) return;
    if (!newProductCategory) {
      showToast("Please select a category.", "error");
      return;
    }
    try {
      setProductSaving(true);

      await adminApi.createProduct({
        name: newProductName,
        category_id: newProductCategory,
        mrp: Number(newProductMrp || newProductPrice),
        selling_price: Number(newProductPrice),
        image_url: newProductImage,
      });

      showToast("Product catalog updated successfully.", "success");
      setNewProductName("");
      setNewProductCategory("");
      setNewProductPrice("");
      setNewProductMrp("");
      setShowAddProduct(false);

      // Reload products
      const prodData = await adminApi.getProducts();
      setProducts(prodData || []);
    } catch (err: any) {
      showToast("Failed to insert product: " + err.message, "error");
    } finally {
      setProductSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      showToast("Enter a category name.", "error");
      return;
    }
    try {
      setCategorySaving(true);
      const created = await adminApi.createCategory(name);
      const catData = await adminApi.getCategories();
      setCategories(catData || []);
      setNewProductCategory(created.id);
      setNewCategoryName("");
      showToast(`Category "${created.name}" ready.`, "success");
    } catch (err: any) {
      showToast("Failed to create category: " + err.message, "error");
    } finally {
      setCategorySaving(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"? Products in this category will also be deleted.`)) {
      return;
    }
    try {
      setCategorySaving(true);
      await adminApi.deleteCategory(cat.id);
      const catData = await adminApi.getCategories();
      setCategories(catData || []);
      const prodData = await adminApi.getProducts();
      setProducts(prodData || []);
      showToast(`Category "${cat.name}" deleted.`, "success");
    } catch (err: any) {
      showToast("Failed to delete category: " + err.message, "error");
    } finally {
      setCategorySaving(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !editProductName || !editProductPrice) return;
    if (!editProductCategory) {
      showToast("Please select a category.", "error");
      return;
    }
    try {
      setProductUpdating(true);
      await adminApi.updateProduct(selectedProduct.id, {
        name: editProductName,
        category_id: editProductCategory,
        mrp: Number(editProductMrp || editProductPrice),
        selling_price: Number(editProductPrice),
        image_url: editProductImage,
        is_available: editProductAvailable,
      });

      showToast("Product updated successfully.", "success");
      setShowEditProduct(false);
      setSelectedProduct(null);

      // Reload products
      const prodData = await adminApi.getProducts();
      setProducts(prodData || []);
    } catch (err: any) {
      showToast("Failed to update product: " + err.message, "error");
    } finally {
      setProductUpdating(false);
    }
  };

  const resetSlotForm = () => {
    setEditingSlotId(null);
    const nextSlotNum = (deliverySlots?.length || 0) + 1;
    setSlotFormName(`Slot - ${nextSlotNum}`);

    if (deliverySlots && deliverySlots.length > 0) {
      let maxEndMin = 0;
      deliverySlots.forEach((slot: any) => {
        if (slot.delivery_end) {
          const parts = slot.delivery_end.split(":");
          if (parts.length === 2) {
            const min = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            if (min > maxEndMin) maxEndMin = min;
          }
        }
      });

      if (maxEndMin > 0 && maxEndMin + 45 < 24 * 60) {
        const startMin = maxEndMin + 30;
        const endMin = startMin + 15;
        const cutoffMin = startMin - 15;

        const formatMin = (m: number) => {
          const hh = String(Math.floor(m / 60)).padStart(2, "0");
          const mm = String(m % 60).padStart(2, "0");
          return `${hh}:${mm}`;
        };

        setSlotFormStart(formatMin(startMin));
        setSlotFormEnd(formatMin(endMin));
        setSlotFormCutoff(formatMin(cutoffMin));
        return;
      }
    }

    setSlotFormStart("09:55");
    setSlotFormEnd("10:10");
    setSlotFormCutoff("09:45");
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotFormName.trim() || !slotFormStart || !slotFormEnd || !slotFormCutoff) {
      showToast("Fill all slot fields.", "error");
      return;
    }

    const parseMin = (tStr: string) => {
      const parts = tStr.split(":");
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    const startMin = parseMin(slotFormStart);
    const endMin = parseMin(slotFormEnd);
    const cutoffMin = parseMin(slotFormCutoff);

    if (startMin >= endMin) {
      showToast("Delivery start time must be before delivery end time.", "error");
      return;
    }
    if (cutoffMin >= startMin) {
      showToast("Order cutoff time must be before delivery start time.", "error");
      return;
    }

    const overlapSlot = deliverySlots.find((slot: any) => {
      if (editingSlotId && slot.id === editingSlotId) return false;
      if (!slot.is_active) return false;
      const sStart = parseMin(slot.delivery_start);
      const sEnd = parseMin(slot.delivery_end);
      return startMin < sEnd && endMin > sStart;
    });

    if (overlapSlot) {
      showToast(
        `Time window (${slotFormStart} - ${slotFormEnd}) overlaps with existing slot "${overlapSlot.name}" (${overlapSlot.delivery_start} - ${overlapSlot.delivery_end}).`,
        "error"
      );
      return;
    }

    try {
      setSlotSaving(true);
      const payload = {
        name: slotFormName.trim(),
        delivery_start: slotFormStart,
        delivery_end: slotFormEnd,
        order_cutoff: slotFormCutoff,
      };
      if (editingSlotId) {
        await adminApi.updateDeliverySlot(editingSlotId, payload);
        showToast("Delivery slot updated.", "success");
      } else {
        await adminApi.createDeliverySlot(payload);
        showToast("Delivery slot added.", "success");
      }
      const slotData = await adminApi.getDeliverySlots();
      setDeliverySlots(slotData || []);
      resetSlotForm();
    } catch (err: any) {
      showToast(err.message || "Failed to save slot", "error");
    } finally {
      setSlotSaving(false);
    }
  };

  const handleEditSlot = (slot: any) => {
    setEditingSlotId(slot.id);
    setSlotFormName(slot.name || "");
    setSlotFormStart(slot.delivery_start || "");
    setSlotFormEnd(slot.delivery_end || "");
    setSlotFormCutoff(slot.order_cutoff || "");
  };

  const handleToggleSlot = async (slot: any) => {
    try {
      await adminApi.toggleDeliverySlot(slot.id, !slot.is_active);
      const slotData = await adminApi.getDeliverySlots();
      setDeliverySlots(slotData || []);
      showToast(
        `Slot ${!slot.is_active ? "activated" : "disabled"}.`,
        "success",
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update slot", "error");
    }
  };

  const handleSaveDeliveryConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = Number(deliveryFee);
    const minFree = Number(minFreeDeliveryAmount);
    if (isNaN(fee) || fee < 0 || isNaN(minFree) || minFree < 0) {
      showToast("Please enter valid delivery fee and free delivery threshold amounts.", "error");
      return;
    }
    try {
      setDeliveryConfigSaving(true);
      await adminApi.updateDeliveryConfig(fee, minFree);
      if (cutoffTime) {
        await adminApi.setCutoff(cutoffTime);
      }
      showToast(`Delivery settings saved (Fee ₹${fee}, Free delivery above ₹${minFree}, Cutoff ${cutoffTime})`, "success");
    } catch (err: any) {
      showToast("Failed to save delivery config: " + err.message, "error");
    } finally {
      setDeliveryConfigSaving(false);
    }
  };

  const handleSavePrintPricing = async (e: React.FormEvent) => {

    e.preventDefault();
    const bw_single = Number(printBwSingle);
    const bw_double = Number(printBwDouble);
    const color_single = Number(printColorSingle);
    const color_double = Number(printColorDouble);
    if (
      ![bw_single, bw_double, color_single, color_double].every((n) => n > 0)
    ) {
      showToast("All print rates must be greater than zero.", "error");
      return;
    }
    try {
      setPrintPricingSaving(true);
      const pricing = await adminApi.updatePrintPricing({
        bw_single,
        bw_double,
        color_single,
        color_double,
      });
      setPrintBwSingle(String(pricing.bw_single));
      setPrintBwDouble(String(pricing.bw_double));
      setPrintColorSingle(String(pricing.color_single));
      setPrintColorDouble(String(pricing.color_double));
      showToast("Print pricing saved.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to save print pricing", "error");
    } finally {
      setPrintPricingSaving(false);
    }
  };

  const handleTrackingAdFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setTrackingAdUploading(true);
      const url = await uploadAdImage(file);
      setTrackingAdImageUrl(url);
      showToast("Image uploaded. Click Save to publish.", "success");
    } catch (err: any) {
      showToast(err.message || "Image upload failed", "error");
    } finally {
      setTrackingAdUploading(false);
    }
  };

  const handleSaveTrackingAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingAdEnabled && !trackingAdImageUrl.trim()) {
      showToast("Upload an advertisement image before enabling ads.", "error");
      return;
    }
    try {
      setTrackingAdSaving(true);
      const ad = await adminApi.updateTrackingAd({
        is_enabled: trackingAdEnabled,
        image_url: trackingAdImageUrl.trim(),
      });
      setTrackingAdEnabled(Boolean(ad.is_enabled));
      setTrackingAdImageUrl(ad.image_url || "");
      showToast("Tracking advertisement saved.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to save tracking ad", "error");
    } finally {
      setTrackingAdSaving(false);
    }
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName || !newPartnerMobile || !newPartnerPass) return;
    try {
      setPartnerSaving(true);
      await adminApi.createPartner({
        name: newPartnerName,
        mobile_number: newPartnerMobile,
        password: newPartnerPass,
      });
      showToast("Onboarded partner successfully.", "success");
      setNewPartnerName("");
      setNewPartnerMobile("");
      setNewPartnerPass("");
      setShowAddPartner(false);

      // Reload partners
      const partnerData = await adminApi.getPartners();
      setPartners(partnerData || []);
    } catch (err: any) {
      showToast("Failed: " + err.message, "error");
    } finally {
      setPartnerSaving(false);
    }
  };

  const handleStudentApproval = async (id: string, approve: boolean) => {
    const status = approve ? "verified" : "rejected";
    try {
      await adminApi.verifyStudent(id, status);
      showToast(`Student verification status marked as ${status}.`, "success");

      // Reload students queue
      const studentData = await adminApi.getStudents();
      setStudents(studentData || []);

      // Update stats
      fetchSummary();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleName.trim() || !newScheduleStart || !newScheduleEnd) {
      showToast("Name, start time, and end time are required.", "error");
      return;
    }
    try {
      setScheduleSaving(true);
      await adminApi.createMenuSchedule({
        name: newScheduleName.trim(),
        start_time: newScheduleStart,
        end_time: newScheduleEnd,
        is_enabled: true,
        display_order: menuSchedules.length + 1,
        category_ids: [],
      });
      showToast("Menu schedule created successfully.", "success");
      setNewScheduleName("");
      setShowAddScheduleModal(false);
      fetchMenuSchedules();
    } catch (err: any) {
      showToast(err.message || "Failed to create schedule", "error");
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleToggleScheduleActive = async (schedule: MenuSchedule) => {
    try {
      const catIDs = schedule.categories?.map((c) => c.category_id) || [];
      await adminApi.updateMenuSchedule(schedule.id, {
        name: schedule.name,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        is_enabled: !schedule.is_enabled,
        display_order: schedule.display_order,
        category_ids: catIDs,
      });
      showToast(`Schedule ${!schedule.is_enabled ? "enabled" : "disabled"}.`, "success");
      fetchMenuSchedules();
    } catch (err: any) {
      showToast(err.message || "Failed to update schedule status", "error");
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (confirm("Are you sure you want to delete this menu schedule?")) {
      try {
        await adminApi.deleteMenuSchedule(scheduleId);
        showToast("Schedule deleted.", "success");
        fetchMenuSchedules();
      } catch (err: any) {
        showToast(err.message || "Failed to delete schedule", "error");
      }
    }
  };

  const handleAddCategoryToSchedule = async (scheduleId: string, categoryId: string) => {
    const schedule = menuSchedules.find((s) => s.id === scheduleId);
    if (!schedule) return;

    const existingCatIDs = schedule.categories?.map((c) => c.category_id) || [];
    if (existingCatIDs.includes(categoryId)) return;

    const updatedCatIDs = [...existingCatIDs, categoryId];

    try {
      await adminApi.updateMenuSchedule(schedule.id, {
        name: schedule.name,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        is_enabled: schedule.is_enabled,
        display_order: schedule.display_order,
        category_ids: updatedCatIDs,
      });
      showToast("Category assigned to schedule.", "success");
      fetchMenuSchedules();
    } catch (err: any) {
      showToast(err.message || "Failed to assign category", "error");
    }
  };

  const handleRemoveCategoryFromSchedule = async (scheduleId: string, categoryId: string) => {
    const schedule = menuSchedules.find((s) => s.id === scheduleId);
    if (!schedule) return;

    const updatedCatIDs = (schedule.categories || [])
      .filter((c) => c.category_id !== categoryId)
      .map((c) => c.category_id);

    try {
      await adminApi.updateMenuSchedule(schedule.id, {
        name: schedule.name,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        is_enabled: schedule.is_enabled,
        display_order: schedule.display_order,
        category_ids: updatedCatIDs,
      });
      showToast("Category removed from schedule.", "success");
      fetchMenuSchedules();
    } catch (err: any) {
      showToast(err.message || "Failed to remove category", "error");
    }
  };


  const handleAssignPartner = async (orderId: string, partnerId: string) => {
    if (!partnerId) return;
    try {
      await adminApi.assignPartner(orderId, partnerId);
      showToast("Order assigned and status dispatched to courier.", "success");
      fetchOrders();
      fetchSummary();
    } catch (e: any) {
      showToast("Assignment failed: " + e.message, "error");
    }
  };

  const handleCancelOrder = async (orderId: string, phone: string) => {
    if (
      confirm(
        `Mark this order as Out of Stock? Refund will be done manually by evening for student mobile: ${phone}`,
      )
    ) {
      try {
        await adminApi.markOutOfStock(orderId);
        showToast(
          `Out of Stock: Order marked. Refund student manually by evening (mobile: ${phone}).`,
          "success",
        );
        fetchOrders();
        fetchSummary();
      } catch (err: any) {
        showToast(err.message, "error");
      }
    }
  };

  const handleDeliverOrder = async (orderId: string) => {
    try {
      await adminApi.deliverOrder(orderId);
      showToast(
        "Counter handover completed and logged successfully.",
        "success",
      );
      fetchOrders();
      fetchSummary();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleUpdateCutoff = async (timeVal: string) => {
    try {
      await adminApi.setCutoff(timeVal);
      setCutoffTime(timeVal);
      showToast(
        `Ordering cutoff time successfully set to ${timeVal}.`,
        "success",
      );
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationTitle || !notificationBody) return;
    try {
      setNotificationSending(true);
      const res = await adminApi.sendNotification(
        notificationTarget,
        notificationTitle,
        notificationBody
      );
      showToast(
        `${res.message} (Targeted: ${res.targetCount})`,
        "success"
      );
      setNotificationTitle("");
      setNotificationBody("");
    } catch (err: any) {
      showToast(err.message || "Failed to send notification", "error");
    } finally {
      setNotificationSending(false);
    }
  };

  // Workload helper for courier active assigned orders
  const getCourierActiveWorkload = (partnerId: string, partnerName: string) => {
    return orders.filter(
      (o) =>
        (o.delivery_partner_id === partnerId || o.delivery_partner_name === partnerName) &&
        o.status !== "delivered" &&
        o.status !== "cancelled" &&
        o.status !== "out_of_stock"
    ).length;
  };

  // CSV Export for Order History
  const exportHistoryCSV = () => {
    if (filteredHistoryOrders.length === 0) {
      showToast("No orders found matching the filters to export.", "error");
      return;
    }
    const headers = [
      "Order Number",
      "Date",
      "Student Name",
      "Phone",
      "Building",
      "Room",
      "Floor",
      "Delivery Slot",
      "Items Summary",
      "Print Jobs Summary",
      "Total Amount (INR)",
      "Order Status",
      "Payment Status",
      "Assigned Courier"
    ];

    const csvRows = [
      headers.join(","),
      ...filteredHistoryOrders.map((o) =>
        [
          `"${o.order_number}"`,
          `"${new Date(o.created_at).toLocaleString()}"`,
          `"${(o.student_name || "").replace(/"/g, '""')}"`,
          `"${o.student_phone || ""}"`,
          `"${o.building || ""}"`,
          `"${o.room_number || ""}"`,
          `"${o.floor}"`,
          `"${(o.slot_name || "").replace(/"/g, '""')}"`,
          `"${(o.items_summary || "").replace(/"/g, '""')}"`,
          `"${(o.print_jobs_summary || "").replace(/"/g, '""')}"`,
          o.total_amount,
          `"${o.status}"`,
          `"${o.payment_status || "paid"}"`,
          `"${(o.delivery_partner_name || "").replace(/"/g, '""')}"`
        ].join(",")
      )
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `CampusBites_Order_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Order history exported to CSV.", "success");
  };

  // Thermal/Invoice Print Slip Helper
  const handlePrintReceipt = (order: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Please allow popups to print order receipt.", "error");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CampusBites Receipt #${order.order_number}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; font-size: 12px; padding: 20px; max-width: 420px; margin: 0 auto; color: #111; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 12px; margin-bottom: 12px; }
            .brand { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
            .sub { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
            .row { display: flex; justify-content: space-between; margin: 5px 0; }
            .bold { font-weight: 800; }
            .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
            .item-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            .item-table th { text-align: left; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            .item-table td { padding: 4px 0; font-size: 11px; }
            .total-box { font-size: 16px; font-weight: 900; background: #f4f4f5; padding: 8px 12px; border-radius: 6px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #666; border-top: 1px solid #eee; pt: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">CAMPUSBITES</div>
            <div class="sub">Official Canteen Dispatch Ticket</div>
            <div style="margin-top:6px; font-weight:bold; font-size: 14px;">Order #${order.order_number}</div>
            <div style="font-size: 10px; color: #666;">${new Date(order.created_at).toLocaleString()}</div>
          </div>
          <div class="row"><span>Customer:</span><span class="bold">${order.student_name || "Student"}</span></div>
          <div class="row"><span>Phone:</span><span>${order.student_phone || "-"}</span></div>
          <div class="row"><span>Address:</span><span class="bold">Room ${order.room_number}, ${order.building} (Floor ${order.floor})</span></div>
          <div class="row"><span>Time Window:</span><span class="bold">${order.slot_name ? `${order.slot_name} (${order.slot_delivery_start}-${order.slot_delivery_end})` : "Instant"}</span></div>
          <div class="divider"></div>
          
          <div class="bold" style="margin-bottom: 6px; font-size: 11px;">FOOD ITEMS PREPARATION:</div>
          <div>${(order.items_summary || "No food items").split(', ').map((it: string) => `• <strong>${it}</strong>`).join('<br/>')}</div>
          
          ${order.print_jobs && order.print_jobs.length > 0 ? `
            <div class="divider"></div>
            <div class="bold" style="margin-bottom: 6px; font-size: 11px; color: #b45309;">PRINT DOCUMENTS ATTACHED (${order.print_jobs.length}):</div>
            <table class="item-table">
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th style="text-align:center;">Copies</th>
                  <th style="text-align:center;">Pages</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${order.print_jobs.map((pj: any) => `
                  <tr>
                    <td><strong>${pj.file_name}</strong><br/><small>${pj.color_mode.toUpperCase()} · ${pj.sides === 'double' ? 'Double Sided' : 'Single Sided'}</small></td>
                    <td style="text-align:center; font-weight:bold;">${pj.copies}</td>
                    <td style="text-align:center;">${pj.page_count}p</td>
                    <td style="text-align:right; font-weight:bold;">₹${pj.line_total}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : order.print_jobs_summary ? `
            <div class="divider"></div>
            <div class="bold" style="margin-bottom: 6px; font-size: 11px; color: #b45309;">PRINT DOCUMENTS ATTACHED:</div>
            <div>${order.print_jobs_summary}</div>
          ` : ""}
          
          <div class="divider"></div>
          <div class="row total-box"><span>GRAND TOTAL:</span><span>₹${order.total_amount.toFixed(0)}</span></div>
          <div class="row" style="margin-top: 8px;"><span>Payment Status:</span><span class="bold" style="color:#059669;">${(order.payment_status || "paid").toUpperCase()}</span></div>
          <div class="row"><span>Assigned Courier:</span><span class="bold">${order.delivery_partner_name || "Pending Assignment"}</span></div>
          <div class="row"><span>Order Status:</span><span class="bold">${order.status.replace(/_/g, ' ').toUpperCase()}</span></div>
          
          <div class="footer">
            Fast Campus Delivery System • CampusBites Operations<br/>
            Printed: ${new Date().toLocaleString()}
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Searching filters
  const filteredStudents = students.filter(
    (s) =>
      s.short_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(studentSearch.toLowerCase()),
  );

  const pickupOrders = orders.filter(
    (o) => (o.not_available_flag || o.status === "customer_not_available") && o.status !== "delivered" && o.status !== "cancelled"
  );

  // Dispatch Desk Filtered Orders
  const filteredDispatchOrders = orders.filter((o) => {
    // Basic Search Filter
    const matchesSearch =
      !orderSearch ||
      o.order_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.room_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
      (o.student_name && o.student_name.toLowerCase().includes(orderSearch.toLowerCase())) ||
      (o.student_phone && o.student_phone.includes(orderSearch));

    // Status Filter
    const matchesStatus =
      dispatchStatusFilter === "all"
        ? true
        : dispatchStatusFilter === "pickups"
        ? (Boolean(o.not_available_flag) || o.status === "customer_not_available") && o.status !== "delivered" && o.status !== "cancelled"
        : o.status === dispatchStatusFilter;

    // Building Filter
    const matchesBuilding =
      dispatchBuildingFilter === "all" || o.building === dispatchBuildingFilter;

    // Slot Filter
    const matchesSlot =
      dispatchSlotFilter === "all" || o.delivery_slot_id === dispatchSlotFilter || o.slot_name === dispatchSlotFilter;

    return matchesSearch && matchesStatus && matchesBuilding && matchesSlot;
  });

  // History Filtered Orders (Searchable Archive)
  const filteredHistoryOrders = orders.filter((o) => {
    // Text search
    const matchesSearch =
      !historySearch ||
      o.order_number.toLowerCase().includes(historySearch.toLowerCase()) ||
      o.room_number.toLowerCase().includes(historySearch.toLowerCase()) ||
      (o.student_name && o.student_name.toLowerCase().includes(historySearch.toLowerCase())) ||
      (o.student_phone && o.student_phone.includes(historySearch)) ||
      (o.items_summary && o.items_summary.toLowerCase().includes(historySearch.toLowerCase()));

    // Status filter
    const matchesStatus =
      historyStatusFilter === "all" || o.status === historyStatusFilter;

    // Date filter
    let matchesDate = true;
    if (historyDateFilter !== "all") {
      const orderDate = new Date(o.created_at);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (historyDateFilter === "today") {
        matchesDate = orderDate >= todayStart;
      } else if (historyDateFilter === "yesterday") {
        const yestStart = new Date(todayStart.getTime() - 86400000);
        matchesDate = orderDate >= yestStart && orderDate < todayStart;
      } else if (historyDateFilter === "this_week") {
        const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
        matchesDate = orderDate >= weekStart;
      }
    }

    // Building filter
    const matchesBuilding =
      historyBuildingFilter === "all" || o.building === historyBuildingFilter;

    // Slot filter
    const matchesSlot =
      historySlotFilter === "all" || o.delivery_slot_id === historySlotFilter || o.slot_name === historySlotFilter;

    // Courier filter
    const matchesCourier =
      historyCourierFilter === "all" ||
      o.delivery_partner_id === historyCourierFilter ||
      o.delivery_partner_name === historyCourierFilter;

    return matchesSearch && matchesStatus && matchesDate && matchesBuilding && matchesSlot && matchesCourier;
  });



  return (
    <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen font-sans flex">
      {/* Auth Gateway Overlay */}
      {!isLoggedIn && (
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative"
          >
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-indigo-600/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-white">Admin Console</h2>
              <p className="text-slate-400 text-xs mt-1">
                Authorized CampusBites Operations access only
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@campusbites.com"
                  required
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl outline-none text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl outline-none text-white text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold py-3.5 rounded-xl flex items-center justify-center space-x-2 text-sm transition"
              >
                {loginLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span>Access Console</span>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Main Console Layout */}
      {isLoggedIn && profile && (
        <div className="flex-1 flex flex-col md:flex-row min-h-screen max-w-full overflow-x-hidden">
          {/* Mobile Navigation Header */}
          <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                A
              </div>
              <div>
                <h1 className="font-extrabold text-sm leading-tight text-white">
                  CampusBites Admin
                </h1>
                <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">
                  Control Desk
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="p-2 bg-slate-800 text-slate-200 hover:text-white rounded-xl border border-slate-700"
            >
              {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Desktop Sidebar Navigation */}
          <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0">
            <div className="p-6 border-b border-slate-800 flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                A
              </div>
              <div>
                <h1 className="font-extrabold text-sm leading-tight text-white">
                  CampusBites Admin
                </h1>
                <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">
                  Control Desk
                </span>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto scrollbar-thin">
              {[
                { id: "orders", label: "Dispatch Desk", icon: ShoppingBag },
                { id: "history", label: "Order History", icon: FileText },
                { id: "pickups", label: "Counter Pickups", icon: Clock },
                { id: "overview", label: "Overview Metrics", icon: TrendingUp },
                { id: "products", label: "Product Catalog", icon: Layers },
                { id: "menu-schedule", label: "Menu Schedule", icon: Calendar },
                { id: "slots", label: "Delivery Slots", icon: Clock },
                { id: "hostel-blocks", label: "Hostel Blocks", icon: Building2 },

                { id: "delivery-config", label: "Delivery Settings", icon: Sparkles },
                { id: "print-pricing", label: "Print Pricing", icon: Printer },

                { id: "tracking-ad", label: "Tracking Ad", icon: ImageIcon },
                { id: "students", label: "Verification Queue", icon: Users },
                {
                  id: "partners",
                  label: "Delivery Couriers",
                  icon: Navigation,
                },
                { id: "logs", label: "Audit Trail Logs", icon: ShieldAlert },
                { id: "notifications", label: "Push Notifications", icon: Bell },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left font-bold text-xs transition ${
                      activeTab === tab.id
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-white hover:bg-slate-850"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Logout button */}
            <div className="p-4 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-4 py-2.5 bg-slate-950 border border-slate-850 hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/40 text-slate-400 rounded-xl font-bold text-xs transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Exit Session</span>
              </button>
            </div>
          </aside>

          {/* Mobile Drawer Overlay */}
          <AnimatePresence>
            {isMobileNavOpen && (
              <div className="fixed inset-0 z-50 md:hidden bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end">
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 max-h-[85vh] flex flex-col"
                >
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                    <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">Admin Workspaces</span>
                    <button onClick={() => setIsMobileNavOpen(false)} className="p-1 text-slate-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <nav className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {[
                      { id: "orders", label: "Dispatch Desk", icon: ShoppingBag },
                      { id: "history", label: "Order History", icon: FileText },
                      { id: "pickups", label: "Counter Pickups", icon: Clock },
                      { id: "overview", label: "Overview Metrics", icon: TrendingUp },
                      { id: "products", label: "Product Catalog", icon: Layers },
                      { id: "menu-schedule", label: "Menu Schedule", icon: Calendar },
                      { id: "slots", label: "Delivery Slots", icon: Clock },
                      { id: "hostel-blocks", label: "Hostel Blocks", icon: Building2 },
                      { id: "delivery-config", label: "Delivery Settings", icon: Sparkles },
                      { id: "print-pricing", label: "Print Pricing", icon: Printer },
                      { id: "tracking-ad", label: "Tracking Ad", icon: ImageIcon },
                      { id: "students", label: "Verification Queue", icon: Users },
                      { id: "partners", label: "Delivery Couriers", icon: Navigation },
                      { id: "logs", label: "Audit Trail Logs", icon: ShieldAlert },
                      { id: "notifications", label: "Push Notifications", icon: Bell },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setActiveTab(tab.id as any);
                            setIsMobileNavOpen(false);
                          }}
                          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left font-bold text-xs transition ${
                            activeTab === tab.id
                              ? "bg-indigo-600 text-white shadow"
                              : "text-slate-400 hover:text-white hover:bg-slate-850"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                  <div className="pt-3 border-t border-slate-800 mt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-4 py-2.5 bg-slate-950 border border-slate-850 hover:bg-red-950/20 hover:text-red-400 text-slate-400 rounded-xl font-bold text-xs"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Exit Session</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Main Content Workspace */}
          <main className="flex-1 flex flex-col bg-slate-950 min-w-0 max-w-full overflow-x-hidden">
            {/* Top Workspace Header */}
            <header className="h-16 border-b border-slate-800 px-4 sm:px-8 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h2 className="font-extrabold text-xs sm:text-sm text-white capitalize truncate">
                  {activeTab.replace(/-/g, " ")} Workspace
                </h2>
                {dataLoading && (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                )}
              </div>

              {/* Order Cutoff Time config widget */}
              <div className="hidden sm:flex items-center space-x-2 bg-slate-900 border border-slate-850 px-3 py-1 rounded-xl">
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">
                  Order Cutoff:
                </span>
                <input
                  type="text"
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  placeholder="e.g. 10:05 AM"
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs text-white font-mono outline-none w-24 text-center focus:border-indigo-500 transition"
                />
                <button
                  onClick={() => handleUpdateCutoff(cutoffTime)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-[9px] font-black uppercase text-white px-2 py-1 rounded-lg"
                >
                  Set
                </button>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <button
                  onClick={fetchAllData}
                  className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-300 transition"
                  title="Reload metrics"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-400 font-medium hidden sm:inline">Logged in:</span>
                <span className="text-indigo-400 font-bold bg-indigo-950/30 border border-indigo-900/30 px-2 py-1 rounded truncate max-w-[120px] sm:max-w-none">
                  {profile.name}
                </span>
              </div>
            </header>

            {/* Tab Workspace Panels */}
            <div className="flex-1 p-3 sm:p-6 lg:p-8 max-w-full overflow-x-hidden overflow-y-auto">
              {/* Tab 1: Overview Dashboard */}
              {activeTab === "overview" && (
                <div className="space-y-8">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Revenue Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                          Shift revenue
                        </span>
                        <span className="text-3xl font-black text-amber-400">
                          ₹{summary.total_revenue.toFixed(0)}
                        </span>
                      </div>
                      <div className="bg-amber-500/10 text-amber-400 p-3.5 rounded-xl border border-amber-500/25">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Orders Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                          Total orders
                        </span>
                        <span className="text-3xl font-black text-indigo-400">
                          {summary.total_orders}
                        </span>
                      </div>
                      <div className="bg-indigo-500/10 text-indigo-400 p-3.5 rounded-xl border border-indigo-500/25">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Verified Students */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                          Verified Students
                        </span>
                        <span className="text-3xl font-black text-emerald-400">
                          {summary.verified_students}
                        </span>
                      </div>
                      <div className="bg-emerald-500/10 text-emerald-400 p-3.5 rounded-xl border border-emerald-500/25">
                        <Users className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Dispatchers Online */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                          Couriers Online
                        </span>
                        <span className="text-3xl font-black text-teal-400">
                          {summary.online_partners}
                        </span>
                      </div>
                      <div className="bg-teal-500/10 text-teal-400 p-3.5 rounded-xl border border-teal-500/25">
                        <Navigation className="w-6 h-6" />
                      </div>
                    </div>
                  </div>

                  {/* Visual Analytics Chart mockup */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                    <h3 className="text-sm font-black text-white mb-6 uppercase tracking-wider">
                      Canteen Hourly Deliveries Traffic
                    </h3>
                    {/* Visual Bar chart custom */}
                    <div className="h-60 flex items-end space-x-4 pt-10 border-b border-slate-800 px-4">
                      {[
                        { hour: "12 PM", count: 32 },
                        { hour: "1 PM", count: 54 },
                        { hour: "2 PM", count: 41 },
                        { hour: "3 PM", count: 18 },
                        { hour: "4 PM", count: 25 },
                        { hour: "5 PM", count: 48 },
                        { hour: "6 PM", count: 65 },
                        { hour: "7 PM", count: 88 },
                        { hour: "8 PM", count: 72 },
                        { hour: "9 PM", count: 45 },
                      ].map((item, idx) => {
                        const pct = `${(item.count / 90) * 100}%`;
                        return (
                          <div
                            key={idx}
                            className="flex-1 flex flex-col items-center group cursor-pointer"
                          >
                            <div
                              className="w-full relative rounded-t-lg bg-indigo-950 border border-indigo-900 group-hover:bg-indigo-600 transition-all duration-300"
                              style={{ height: pct }}
                            >
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-950 text-indigo-400 border border-slate-850 px-1.5 py-0.5 rounded text-[10px] opacity-0 group-hover:opacity-100 transition">
                                {item.count}
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold mt-2">
                              {item.hour}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Menu Schedule (Time-Based Category Map) */}
              {activeTab === "menu-schedule" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-white flex items-center space-x-2">
                        <span>🗓️ Menu Schedule & Time-Based Category Map</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Configure which food categories appear during Morning, Lunch, Evening, and Night windows.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setNewScheduleName("");
                        setNewScheduleStart("08:00");
                        setNewScheduleEnd("11:00");
                        setShowAddScheduleModal(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-indigo-500/20 transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Time Slot</span>
                    </button>
                  </div>

                  {/* Add Schedule Modal Overlay */}
                  {showAddScheduleModal && (
                    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
                      <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
                      >
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                          <h4 className="font-extrabold text-base text-white">Create Menu Schedule Slot</h4>
                          <button
                            onClick={() => setShowAddScheduleModal(false)}
                            className="text-slate-400 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <form onSubmit={handleCreateSchedule} className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Schedule Window Name
                            </label>
                            <input
                              type="text"
                              required
                              value={newScheduleName}
                              onChange={(e) => setNewScheduleName(e.target.value)}
                              placeholder="e.g. Late Night Munchies"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                required
                                value={newScheduleStart}
                                onChange={(e) => setNewScheduleStart(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                required
                                value={newScheduleEnd}
                                onChange={(e) => setNewScheduleEnd(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="pt-2 flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setShowAddScheduleModal(false)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={scheduleSaving}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold"
                            >
                              {scheduleSaving ? "Saving..." : "Create Slot"}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    </div>
                  )}

                  {/* Live Schedules Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {menuSchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-extrabold text-base text-white">{schedule.name}</h4>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${schedule.is_enabled
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-slate-800 text-slate-400"
                                  }`}
                              >
                                {schedule.is_enabled ? "Active" : "Disabled"}
                              </span>
                            </div>
                            <p className="text-xs text-indigo-400 font-mono mt-0.5">
                              ⏰ {schedule.start_time} — {schedule.end_time}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleToggleScheduleActive(schedule)}
                              className="text-xs text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded-lg transition"
                            >
                              {schedule.is_enabled ? "Disable" : "Enable"}
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(schedule.id)}
                              className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg transition"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Assigned Food Categories:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {schedule.categories && schedule.categories.length > 0 ? (
                              schedule.categories.map((cat) => (
                                <span
                                  key={cat.category_id}
                                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1.5"
                                >
                                  <span>{cat.category_name}</span>
                                  <button
                                    onClick={() => handleRemoveCategoryFromSchedule(schedule.id, cat.category_id)}
                                    className="text-slate-400 hover:text-red-400 ml-1"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <p className="text-xs text-slate-500 italic">No categories assigned to this window yet.</p>
                            )}
                          </div>
                        </div>

                        {/* Category Selector */}
                        <div className="pt-2 border-t border-slate-800 flex items-center space-x-2">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAddCategoryToSchedule(schedule.id, e.target.value);
                                e.target.value = "";
                              }
                            }}
                            defaultValue=""
                            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500 flex-1"
                          >
                            <option value="" disabled>
                              + Assign Category to {schedule.name}...
                            </option>
                            {categories
                              .filter((c) => !schedule.categories?.some((sc) => sc.category_id === c.id))
                              .map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Product Catalog CRUD */}
              {activeTab === "products" && (
                <div className="space-y-6">

                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-white">
                      Food Menu Inventory
                    </h3>
                    <button
                      onClick={() => setShowAddProduct(true)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Catalog Item</span>
                    </button>
                  </div>

                  {/* Add Product Modal Overlay */}
                  {showAddProduct && (
                    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
                      <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-4"
                      >
                        <h3 className="text-lg font-black text-white border-b border-slate-800 pb-2">
                          Add New Catalog Item
                        </h3>
                        <form
                          onSubmit={handleCreateProduct}
                          className="space-y-4"
                        >
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Item Name
                            </label>
                            <input
                              type="text"
                              value={newProductName}
                              onChange={(e) =>
                                setNewProductName(e.target.value)
                              }
                              placeholder="e.g. Cheese French Fries"
                              required
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Category
                            </label>
                            <select
                              value={newProductCategory}
                              onChange={(e) =>
                                setNewProductCategory(e.target.value)
                              }
                              required
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                            >
                              <option value="" disabled>
                                Select a category
                              </option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                            <div className="mt-2 flex gap-2">
                              <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) =>
                                  setNewCategoryName(e.target.value)
                                }
                                placeholder="+ New category name"
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                              />
                              <button
                                type="button"
                                onClick={handleCreateCategory}
                                disabled={categorySaving}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg disabled:opacity-50"
                              >
                                {categorySaving ? "..." : "Add"}
                              </button>
                            </div>
                            {categories.length > 0 && (
                              <div className="mt-2.5 p-2 bg-slate-950/70 border border-slate-800 rounded-lg space-y-1.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                  Catalog Categories ({categories.length}):
                                </span>
                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                  {categories.map((cat) => (
                                    <span
                                      key={cat.id}
                                      className="inline-flex items-center space-x-1 bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md"
                                    >
                                      <span>{cat.name}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCategory(cat)}
                                        title={`Delete ${cat.name}`}
                                        className="text-slate-500 hover:text-red-400 transition ml-0.5 p-0.5"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                MRP (₹)
                              </label>
                              <input
                                type="number"
                                value={newProductMrp}
                                onChange={(e) =>
                                  setNewProductMrp(e.target.value)
                                }
                                placeholder="60"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                Selling Price (₹)
                              </label>
                              <input
                                type="number"
                                value={newProductPrice}
                                onChange={(e) =>
                                  setNewProductPrice(e.target.value)
                                }
                                placeholder="49"
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Image URL
                            </label>
                            <input
                              type="text"
                              value={newProductImage}
                              onChange={(e) =>
                                setNewProductImage(e.target.value)
                              }
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                            />
                          </div>
                          <div className="flex space-x-2 pt-4">
                            <button
                              type="button"
                              onClick={() => setShowAddProduct(false)}
                              className="w-1/3 bg-slate-950 border border-slate-850 rounded-lg text-xs font-bold text-slate-400"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={productSaving}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2.5 rounded-lg text-xs font-bold"
                            >
                              {productSaving ? "Saving..." : "Save Item"}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    </div>
                  )}

                  {/* Edit Product Modal Overlay */}
                  {showEditProduct && selectedProduct && (
                    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
                      <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-4"
                      >
                        <h3 className="text-lg font-black text-white border-b border-slate-800 pb-2">
                          Edit Catalog Item
                        </h3>
                        <form
                          onSubmit={handleUpdateProduct}
                          className="space-y-4"
                        >
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Item Name
                            </label>
                            <input
                              type="text"
                              value={editProductName}
                              onChange={(e) =>
                                setEditProductName(e.target.value)
                              }
                              required
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Category
                            </label>
                            <select
                              value={editProductCategory}
                              onChange={(e) =>
                                setEditProductCategory(e.target.value)
                              }
                              required
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                            >
                              <option value="" disabled>
                                Select a category
                              </option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                MRP (₹)
                              </label>
                              <input
                                type="number"
                                value={editProductMrp}
                                onChange={(e) =>
                                  setEditProductMrp(e.target.value)
                                }
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                Selling Price (₹)
                              </label>
                              <input
                                type="number"
                                value={editProductPrice}
                                onChange={(e) =>
                                  setEditProductPrice(e.target.value)
                                }
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Image URL
                            </label>
                            <input
                              type="text"
                              value={editProductImage}
                              onChange={(e) =>
                                setEditProductImage(e.target.value)
                              }
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                            />
                          </div>
                          <div className="flex items-center space-x-2 pt-2">
                            <input
                              type="checkbox"
                              id="editProductAvailable"
                              checked={editProductAvailable}
                              onChange={(e) =>
                                setEditProductAvailable(e.target.checked)
                              }
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800"
                            />
                            <label
                              htmlFor="editProductAvailable"
                              className="text-xs font-bold text-slate-350 select-none"
                            >
                              Item is Available (In Stock)
                            </label>
                          </div>
                          <div className="flex space-x-2 pt-4">
                            <button
                              type="button"
                              onClick={() => {
                                setShowEditProduct(false);
                                setSelectedProduct(null);
                              }}
                              className="w-1/3 bg-slate-950 border border-slate-850 rounded-lg text-xs font-bold text-slate-400"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={productUpdating}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2.5 rounded-lg text-xs font-bold"
                            >
                              {productUpdating ? "Saving..." : "Save Changes"}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    </div>
                  )}

                  {/* Products Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow"
                      >
                        <div className="h-40 bg-slate-950 overflow-hidden relative">
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur border border-slate-800 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase text-slate-400">
                            {p.category_name}
                          </span>
                        </div>
                        <div className="p-4 space-y-3">
                          <h4 className="font-extrabold text-sm text-white">
                            {p.name}
                          </h4>
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="font-black text-amber-400">
                                ₹{p.selling_price}
                              </span>
                              <span className="line-through text-slate-500 text-[10px]">
                                ₹{p.mrp}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold ${p.is_available
                                  ? "bg-emerald-950 text-emerald-400"
                                  : "bg-red-950/60 text-red-400"
                                }`}
                            >
                              {p.is_available ? "In Stock" : "Sold Out"}
                            </span>
                          </div>
                          <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                            <button
                              onClick={async () => {
                                try {
                                  await adminApi.updateProduct(p.id, {
                                    name: p.name,
                                    category_id: p.category_id,
                                    mrp: p.mrp,
                                    selling_price: p.selling_price,
                                    image_url: p.image_url,
                                    is_available: !p.is_available,
                                  });
                                  showToast(
                                    `${p.name} marked as ${!p.is_available ? "In Stock" : "Out of Stock"}`,
                                    "success",
                                  );
                                  const prodData = await adminApi.getProducts();
                                  setProducts(prodData || []);
                                } catch (err: any) {
                                  showToast(err.message, "error");
                                }
                              }}
                              className={`text-[9px] font-extrabold px-2 py-1 rounded transition ${p.is_available
                                  ? "bg-red-950/65 text-red-400 hover:bg-red-950 border border-red-500/20"
                                  : "bg-emerald-950/65 text-emerald-400 hover:bg-emerald-950 border border-emerald-500/20"
                                }`}
                            >
                              {p.is_available
                                ? "Mark Out of Stock"
                                : "Mark In Stock"}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProduct(p);
                                setEditProductName(p.name);
                                setEditProductCategory(p.category_id);
                                setEditProductMrp(String(p.mrp));
                                setEditProductPrice(String(p.selling_price));
                                setEditProductImage(p.image_url);
                                setEditProductAvailable(p.is_available);
                                setShowEditProduct(true);
                              }}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                            >
                              Edit Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Delivery Slots */}
              {activeTab === "slots" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 className="text-lg font-black text-white">
                        Daily Delivery Slots
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Recurring every day (IST). A slot closes for ordering
                        after its cutoff, even if the global cutoff is still open.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetSlotForm}
                      className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl"
                    >
                      Add Another Slot
                    </button>
                  </div>

                  <form
                    onSubmit={handleSaveSlot}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
                  >
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Slot Name
                      </label>
                      <input
                        type="text"
                        value={slotFormName}
                        onChange={(e) => setSlotFormName(e.target.value)}
                        placeholder="e.g. Evening Slot"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Order Before
                      </label>
                      <input
                        type="time"
                        value={slotFormCutoff}
                        onChange={(e) => setSlotFormCutoff(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Delivery Start
                      </label>
                      <input
                        type="time"
                        value={slotFormStart}
                        onChange={(e) => setSlotFormStart(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Delivery End
                      </label>
                      <input
                        type="time"
                        value={slotFormEnd}
                        onChange={(e) => setSlotFormEnd(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none"
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={slotSaving}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase py-2.5 rounded-xl disabled:opacity-50"
                      >
                        {slotSaving
                          ? "Saving..."
                          : editingSlotId
                            ? "Update Slot"
                            : "Save Slot"}
                      </button>
                      {editingSlotId && (
                        <button
                          type="button"
                          onClick={resetSlotForm}
                          className="px-3 py-2.5 bg-slate-800 text-slate-300 text-[10px] font-bold rounded-xl"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>

                  {deliverySlots.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 font-bold">
                      No delivery slots yet. Add your first slot above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {deliverySlots.map((slot) => {
                        const statusLabel = !slot.is_active
                          ? "Disabled"
                          : slot.is_ordering_open
                            ? "Open"
                            : "Cutoff Passed";
                        const statusClass = !slot.is_active
                          ? "bg-slate-800 text-slate-400"
                          : slot.is_ordering_open
                            ? "bg-emerald-950 text-emerald-400"
                            : "bg-amber-950 text-amber-400";
                        return (
                          <div
                            key={slot.id}
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h4 className="font-black text-white text-sm">
                                  {slot.name}
                                </h4>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Delivery {slot.delivery_start} –{" "}
                                  {slot.delivery_end}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  Order before {slot.order_cutoff}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${statusClass}`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <div className="flex gap-2 pt-2 border-t border-slate-850">
                              <button
                                type="button"
                                onClick={() => handleEditSlot(slot)}
                                className="flex-1 text-[10px] font-bold bg-slate-950 border border-slate-800 text-indigo-300 py-2 rounded-xl"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleSlot(slot)}
                                className={`flex-1 text-[10px] font-bold py-2 rounded-xl border ${slot.is_active
                                    ? "bg-red-950/40 border-red-500/20 text-red-300"
                                    : "bg-emerald-950/40 border-emerald-500/20 text-emerald-300"
                                  }`}
                              >
                                {slot.is_active ? "Disable" : "Activate"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "delivery-config" && (
                <div className="space-y-6 max-w-xl">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      Dynamic Delivery Settings
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Set standard delivery fees and minimum cart amounts required to qualify for free delivery.
                    </p>
                  </div>
                  <form
                    onSubmit={handleSaveDeliveryConfig}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Standard Delivery Fee (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={deliveryFee}
                          onChange={(e) => setDeliveryFee(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Free Delivery Minimum (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={minFreeDeliveryAmount}
                          onChange={(e) => setMinFreeDeliveryAmount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Global Daily Order Cutoff Time
                      </label>
                      <input
                        type="text"
                        value={cutoffTime}
                        onChange={(e) => setCutoffTime(e.target.value)}
                        placeholder="e.g. 10:05 AM or 23:59"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Accepts 12-hour format (e.g. 10:05 AM or 2:30 PM) or 24-hour format (e.g. 23:59). Type 00:01 to pause ordering.
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={deliveryConfigSaving}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {deliveryConfigSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Save Delivery Settings"
                      )}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === "print-pricing" && (
                <div className="space-y-6 max-w-xl">
                  <div>

                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Printer className="w-5 h-5 text-indigo-400" />
                      Print Pricing
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Per-page rates used for student print jobs (locked at checkout).
                    </p>
                  </div>
                  <form
                    onSubmit={handleSavePrintPricing}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          B&amp;W Single
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={printBwSingle}
                          onChange={(e) => setPrintBwSingle(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          B&amp;W Double
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={printBwDouble}
                          onChange={(e) => setPrintBwDouble(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Color Single
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={printColorSingle}
                          onChange={(e) => setPrintColorSingle(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Color Double
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={printColorDouble}
                          onChange={(e) => setPrintColorDouble(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={printPricingSaving}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {printPricingSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Save Rates"
                      )}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === "tracking-ad" && (
                <div className="space-y-6 max-w-xl">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-indigo-400" />
                      Tracking Advertisement
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Upload one image from your dashboard. When enabled, students
                      see it on the order tracking page (tracking starts minimized).
                    </p>
                  </div>
                  <form
                    onSubmit={handleSaveTrackingAd}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5"
                  >
                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                      <span className="text-sm font-bold text-slate-200">
                        Allow advertising on tracking page
                      </span>
                      <input
                        type="checkbox"
                        checked={trackingAdEnabled}
                        onChange={(e) => setTrackingAdEnabled(e.target.checked)}
                        className="w-5 h-5 accent-indigo-500"
                      />
                    </label>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                        Advertisement image
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        onChange={handleTrackingAdFile}
                        disabled={trackingAdUploading}
                        className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-950 file:text-indigo-300 file:font-bold"
                      />
                      {trackingAdUploading && (
                        <p className="text-[10px] text-indigo-300 mt-2 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Uploading
                          to Cloudinary…
                        </p>
                      )}
                    </div>

                    {trackingAdImageUrl ? (
                      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                        <p className="text-[9px] font-bold text-slate-500 uppercase px-3 py-2 border-b border-slate-800">
                          Preview (student view)
                        </p>
                        <img
                          src={trackingAdImageUrl}
                          alt="Tracking advertisement preview"
                          className="w-full h-auto max-h-[50vh] object-contain bg-black"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-xs text-slate-500">
                        No image uploaded yet
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={trackingAdSaving || trackingAdUploading}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {trackingAdSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Save Advertisement"
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Tab: Hostel Blocks / Building Management */}
              {activeTab === "hostel-blocks" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
                    <div>
                      <h3 className="text-xl font-black text-white flex items-center space-x-2">
                        <Building2 className="w-5 h-5 text-indigo-400" />
                        <span>Hostel Blocks & Buildings Management</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Add campus buildings/hostels and toggle delivery service availability. Disabled blocks display an instant warning in Student Portal.
                      </p>
                    </div>
                  </div>

                  {/* Add New Block Form */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Add New Hostel Block / Building</h4>
                    <form onSubmit={handleCreateHostelBlock} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Block / Building Name</label>
                        <input
                          type="text"
                          value={newBlockName}
                          onChange={(e) => setNewBlockName(e.target.value)}
                          placeholder="e.g. BH-1, Girls Hostel 2, MBA Block"
                          required
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs outline-none text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Display Sort Order</label>
                        <input
                          type="number"
                          value={newBlockOrder}
                          onChange={(e) => setNewBlockOrder(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs outline-none text-white font-bold"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={blockSaving}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition disabled:opacity-50"
                      >
                        {blockSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>Add Hostel Block</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Hostel Blocks Management Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Configured Hostel Blocks ({hostelBlocks.length})</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 bg-slate-950 text-slate-400 uppercase font-black tracking-wider text-[9px]">
                            <th className="p-4">Block / Building Name</th>
                            <th className="p-4 text-center">Sort Order</th>
                            <th className="p-4 text-center">Service Status</th>
                            <th className="p-4 text-center">Toggle Service</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hostelBlocks.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-500 font-semibold">
                                No hostel blocks configured yet.
                              </td>
                            </tr>
                          ) : (
                            hostelBlocks.map((block) => (
                              <tr key={block.id} className="border-b border-slate-850 hover:bg-slate-850/30 transition">
                                <td className="p-4 font-bold text-white text-sm">
                                  {block.name}
                                </td>
                                <td className="p-4 text-center font-mono font-bold text-slate-300">
                                  {block.display_order}
                                </td>
                                <td className="p-4 text-center">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                      block.is_enabled
                                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                                        : "bg-red-950 text-red-400 border border-red-800/40"
                                    }`}
                                  >
                                    {block.is_enabled ? "Active Delivery" : "Disabled (Off-limits)"}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <button
                                    onClick={() => handleToggleHostelBlock(block.id)}
                                    className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition border ${
                                      block.is_enabled
                                        ? "bg-red-950/40 text-red-300 border-red-800/50 hover:bg-red-900/50"
                                        : "bg-emerald-950/40 text-emerald-300 border-emerald-800/50 hover:bg-emerald-900/50"
                                    }`}
                                  >
                                    {block.is_enabled ? "Disable Service" : "Enable Service"}
                                  </button>
                                </td>
                                <td className="p-4 text-right">
                                  <button
                                    onClick={() => handleDeleteHostelBlock(block.id, block.name)}
                                    className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition"
                                    title="Delete Block"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: OCR Student Approval Queue */}
              {activeTab === "students" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
                    <h3 className="text-lg font-black text-white">
                      Fuzzy OCR Verification Queue
                    </h3>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search student or roll..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs outline-none text-white focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Students Queue Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 bg-slate-950 text-slate-400 uppercase font-black tracking-wider text-[9px]">
                            <th className="p-4">Student Profile</th>
                            <th className="p-4">OCR Extracted Check</th>
                            <th className="p-4 text-center">Fuzzy Match %</th>
                            <th className="p-4 text-center">Confidence</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-right">
                              Approval Decisions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="p-8 text-center text-slate-500 font-semibold"
                              >
                                No students in queue
                              </td>
                            </tr>
                          ) : (
                            filteredStudents.map((student) => (
                              <tr
                                key={student.id}
                                className="border-b border-slate-850 hover:bg-slate-850/30 transition"
                              >
                                <td className="p-4">
                                  <div className="font-bold text-white text-sm flex items-center space-x-2">
                                    <span>{student.short_name}</span>
                                    <button
                                      onClick={() =>
                                        setInspectedStudent(student)
                                      }
                                      className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold ml-1 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded hover:bg-indigo-500/20"
                                    >
                                      Inspect Dossier
                                    </button>
                                  </div>
                                  <div className="text-slate-400 mt-0.5">
                                    Roll: {student.roll_number}
                                  </div>
                                  <div className="text-slate-550 text-[10px] mt-0.5">
                                    Mob: {student.mobile_number}
                                  </div>
                                </td>
                                <td className="p-4">
                                  {student.ocr_extracted_name ? (
                                    <>
                                      <div className="font-semibold text-slate-300">
                                        Name: {student.ocr_extracted_name}
                                      </div>
                                      <div className="text-slate-400 mt-0.5">
                                        Roll:{" "}
                                        {student.ocr_extracted_roll_number}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-slate-550 italic">
                                      No document files
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 text-center font-bold text-indigo-400">
                                  {student.name_similarity_score
                                    ? `${student.name_similarity_score.toFixed(1)}%`
                                    : "--"}
                                </td>
                                <td className="p-4 text-center capitalize">
                                  {student.confidence_level ? (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[9px] font-black ${student.confidence_level === "high"
                                          ? "bg-emerald-950 text-emerald-400"
                                          : student.confidence_level ===
                                            "medium"
                                            ? "bg-amber-950 text-amber-400"
                                            : "bg-red-950 text-red-400"
                                        }`}
                                    >
                                      {student.confidence_level}
                                    </span>
                                  ) : (
                                    "--"
                                  )}
                                </td>
                                <td className="p-4 text-center capitalize">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${student.verification_status === "verified"
                                        ? "bg-emerald-950 text-emerald-400"
                                        : student.verification_status ===
                                          "rejected"
                                          ? "bg-red-950 text-red-400"
                                          : "bg-slate-950 text-slate-400"
                                      }`}
                                  >
                                    {student.verification_status}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="inline-flex space-x-1">
                                    {student.verification_status !== "verified" && (
                                      <button
                                        onClick={() => handleStudentApproval(student.id, true)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg"
                                        title="Unblock student"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {student.verification_status !== "rejected" && (
                                      <button
                                        onClick={() => handleStudentApproval(student.id, false)}
                                        className="bg-red-650 hover:bg-red-600 text-white p-1.5 rounded-lg"
                                        title="Block student"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Orders Logistics & Dispatch Desk */}
              {activeTab === "orders" && (
                <div className="space-y-6">
                  {/* Top Header Row */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-white flex items-center space-x-2">
                        <Truck className="w-5 h-5 text-indigo-400" />
                        <span>Logistics & Dispatch Desk</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Real-time canteen order dispatch pipeline, active courier workload management, and hostel corridor batching.
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setShowAddPartner(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 shadow"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Onboard Courier</span>
                      </button>
                      <button
                        onClick={fetchOrders}
                        className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 text-xs px-3 py-2 rounded-xl flex items-center space-x-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh Feed</span>
                      </button>
                    </div>
                  </div>

                  {/* Dispatch KPI Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Pending Assignment
                      </span>
                      <span className="text-2xl font-black text-amber-400">
                        {orders.filter((o) => (o.status === "received" || o.status === "preparing" || o.status === "packed") && !o.delivery_partner_name).length}
                      </span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        In Prep / Packing
                      </span>
                      <span className="text-2xl font-black text-indigo-400">
                        {orders.filter((o) => o.status === "preparing" || o.status === "packed").length}
                      </span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        En Route (Out)
                      </span>
                      <span className="text-2xl font-black text-teal-400">
                        {orders.filter((o) => o.status === "out_for_delivery" || o.status === "assigned").length}
                      </span>
                    </div>

                    <div
                      onClick={() => setDispatchStatusFilter(dispatchStatusFilter === "pickups" ? "all" : "pickups")}
                      className={`bg-slate-900 border rounded-2xl p-4 shadow cursor-pointer transition ${dispatchStatusFilter === "pickups" ? "border-rose-500 ring-2 ring-rose-500/50" : "border-slate-800 hover:border-slate-700"}`}
                    >
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Counter Pickups Waiting
                      </span>
                      <span className="text-2xl font-black text-rose-400">
                        {pickupOrders.length}
                      </span>
                    </div>
                  </div>

                  {/* Live Courier Roster & Active Workload Bar */}
                  {partners.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                          <Users className="w-3.5 h-3.5 text-teal-400" />
                          <span>Active Delivery Couriers Workload:</span>
                        </span>
                        <span className="text-[10px] text-teal-400 font-bold">
                          {partners.filter(p => p.is_online).length} Online / {partners.length} Onboarded
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {partners.map((partner) => {
                          const workload = getCourierActiveWorkload(partner.id, partner.name);
                          return (
                            <div
                              key={partner.id}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-2 ${partner.is_online
                                  ? workload > 3
                                    ? "bg-amber-950/40 border-amber-500/30 text-amber-300"
                                    : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                                  : "bg-slate-950 border-slate-800 text-slate-500"
                                }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${partner.is_online ? "bg-emerald-400" : "bg-slate-600"}`} />
                              <span>{partner.name}</span>
                              <span className="bg-slate-950 px-1.5 py-0.5 rounded text-[10px] border border-slate-800">
                                {workload} active
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Filter Toolbar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      {/* Search Bar */}
                      <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          placeholder="Search order number, student name, phone, room..."
                          className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none text-white focus:border-indigo-500"
                        />
                      </div>

                      {/* Dropdown filters */}
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {/* Hostel Building Filter */}
                        <select
                          value={dispatchBuildingFilter}
                          onChange={(e) => setDispatchBuildingFilter(e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                        >
                          <option value="all">🏢 All Hostel Blocks</option>
                          <option value="N Block">N Block</option>
                          <option value="A Block">A Block</option>
                          <option value="H Block">H Block</option>
                          <option value="U Block">U Block</option>
                          <option value="Lara">Lara</option>
                          <option value="Pharmacy">Pharmacy</option>
                        </select>

                        {/* Delivery Slot Filter */}
                        <select
                          value={dispatchSlotFilter}
                          onChange={(e) => setDispatchSlotFilter(e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                        >
                          <option value="all">⏰ All Delivery Slots</option>
                          {deliverySlots.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              {slot.name} ({slot.delivery_start}–{slot.delivery_end})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick Status Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                        Status Filter:
                      </span>
                      {[
                        { id: "all", label: "All Orders" },
                        { id: "pickups", label: "🏬 Counter Pickups" },
                        { id: "received", label: "Received" },
                        { id: "preparing", label: "Preparing" },
                        { id: "packed", label: "Packed" },
                        { id: "out_for_delivery", label: "Out for Delivery" },
                        { id: "delivered", label: "Delivered" },
                        { id: "out_of_stock", label: "Out of Stock" },
                        { id: "cancelled", label: "Cancelled" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setDispatchStatusFilter(tab.id)}
                          className={`text-xs font-extrabold px-3 py-1 rounded-xl transition ${dispatchStatusFilter === tab.id
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                            }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dispatch desk cards */}
                  {filteredDispatchOrders.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 font-semibold shadow">
                      No matching live orders in dispatch queue.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredDispatchOrders.map((order) => (
                        <div
                          key={order.id}
                          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex flex-col justify-between space-y-4 hover:border-slate-700 transition duration-200"
                        >
                          {/* Header info */}
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-[10px] font-black text-indigo-400 block tracking-widest uppercase">
                                  Order #{order.order_number}
                                </span>
                                <button
                                  onClick={() => setInspectedOrder(order)}
                                  className="text-[9px] bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded font-bold transition"
                                >
                                  View Receipt ↗
                                </button>
                              </div>
                              <h4 className="font-black text-sm text-white mt-1">
                                {order.student_name}
                              </h4>
                              <span className="text-[10px] text-slate-500 font-semibold">
                                {order.student_phone}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${order.payment_status === "paid"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                                  : "bg-red-950/60 text-red-400 border border-red-500/20"
                                }`}
                            >
                              {order.payment_status || "PAID"}
                            </span>
                          </div>

                          {/* Counter Pickup Badge with PIN */}
                          {(order.not_available_flag || order.status === "customer_not_available") && (
                            <div className="bg-amber-950/80 border border-amber-500/50 p-2.5 rounded-xl space-y-1 text-xs">
                              <div className="font-extrabold text-amber-400 flex items-center justify-between">
                                <span>🏬 Counter Pickup (Not Available)</span>
                                <span className="font-mono bg-slate-950 px-2 py-0.5 rounded text-white border border-amber-500/30 font-black">
                                  PIN: {getVerificationCode(order.order_number)}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-300">
                                Courier flagged student as Not Available. Order is waiting at Canteen Counter.
                              </p>
                            </div>
                          )}

                          {/* Items summary */}
                          <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-850">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Items to Send
                            </span>
                            <p className="text-xs text-slate-200 font-extrabold leading-relaxed">
                              {order.items_summary || "No items listed"}
                            </p>
                            {order.print_jobs_summary && (
                              <p className="text-[11px] text-amber-300 font-semibold mt-2 leading-relaxed flex items-center space-x-1">
                                <Printer className="w-3.5 h-3.5 inline mr-1 shrink-0 text-amber-400" />
                                <span>{order.print_jobs_summary}</span>
                              </p>
                            )}
                          </div>

                          {/* Location & Amount */}
                          <div className="space-y-1">
                            <div className="flex items-center text-xs text-slate-350 space-x-1.5">
                              <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="font-semibold text-slate-200 truncate">
                                Room {order.room_number}, {order.building}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-550 pl-5 font-semibold">
                              Floor {order.floor}
                            </div>
                            <div className="text-[10px] text-indigo-300 pl-5 font-semibold">
                              {order.slot_name
                                ? `Slot: ${order.slot_name} (${order.slot_delivery_start}–${order.slot_delivery_end})`
                                : "Standard Delivery"}
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-slate-850 pt-4 flex flex-col space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                Grand Total
                              </span>
                              <span className="text-sm font-black text-amber-400">
                                ₹{order.total_amount.toFixed(0)}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                              <span className="text-[10px] font-bold text-slate-550">
                                Dispatch Status
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${order.status === "delivered"
                                    ? "bg-emerald-950 text-emerald-400"
                                    : order.status === "out_of_stock"
                                      ? "bg-red-950 text-red-400"
                                      : order.status === "out_for_delivery"
                                        ? "bg-teal-950 text-teal-400"
                                        : "bg-slate-950 text-slate-400"
                                  }`}
                              >
                                {order.status.replace(/_/g, " ")}
                              </span>
                            </div>

                            {/* Actions block */}
                            <div className="pt-2 flex items-center justify-between gap-2">
                              {/* Out of Stock button */}
                              {order.status !== "delivered" &&
                                order.status !== "cancelled" &&
                                order.status !== "out_of_stock" && (
                                  <button
                                    onClick={() =>
                                      handleCancelOrder(
                                        order.id,
                                        order.student_phone,
                                      )
                                    }
                                    className="text-[9.5px] font-extrabold bg-red-950/60 hover:bg-red-950 text-red-400 px-2.5 py-2 rounded-xl transition border border-red-500/10 active:scale-95 duration-150"
                                  >
                                    Out of Stock
                                  </button>
                                )}

                              {/* Print slip button */}
                              <button
                                onClick={() => handlePrintReceipt(order)}
                                className="text-[9.5px] font-extrabold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 p-2 rounded-xl"
                                title="Print Slip"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Assign Courier dropdown */}
                              {order.status === "received" ||
                                order.status === "preparing" ||
                                order.status === "packed" ||
                                order.status === "assigned" ? (
                                <select
                                  onChange={(e) =>
                                    handleAssignPartner(
                                      order.id,
                                      e.target.value,
                                    )
                                  }
                                  value={order.delivery_partner_id || ""}
                                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-[10px] p-2 rounded-xl outline-none focus:border-indigo-500"
                                >
                                  <option value="" disabled>
                                    Assign Courier...
                                  </option>
                                  {partners
                                    .filter((p) => p.is_online)
                                    .map((p) => {
                                      const workload = getCourierActiveWorkload(p.id, p.name);
                                      return (
                                        <option key={p.id} value={p.id}>
                                          {p.name} ({workload} active)
                                        </option>
                                      );
                                    })}
                                </select>
                              ) : (
                                <div className="text-[10px] text-slate-400 font-semibold italic flex items-center space-x-1 py-1">
                                  <span>
                                    Courier: {order.delivery_partner_name || "Assigned"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Order History & Operations Archive */}
              {activeTab === "history" && (
                <div className="space-y-6">
                  {/* Top Title & Header Actions */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-white flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        <span>All Order History & Operations Archive</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Searchable, filterable ledger of all historical orders, print jobs, courier dispatches, and receipts.
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={exportHistoryCSV}
                        className="bg-emerald-650 hover:bg-emerald-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </button>

                      {/* View Mode Toggle */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex items-center space-x-1">
                        <button
                          onClick={() => setHistoryViewMode("table")}
                          className={`p-1.5 rounded-lg text-xs font-bold transition ${historyViewMode === "table"
                              ? "bg-indigo-600 text-white"
                              : "text-slate-400 hover:text-white"
                            }`}
                          title="Table View"
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setHistoryViewMode("cards")}
                          className={`p-1.5 rounded-lg text-xs font-bold transition ${historyViewMode === "cards"
                              ? "bg-indigo-600 text-white"
                              : "text-slate-400 hover:text-white"
                            }`}
                          title="Grid Cards View"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric KPI Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Total Orders
                      </span>
                      <span className="text-2xl font-black text-white">
                        {filteredHistoryOrders.length}
                      </span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Fulfilled & Delivered
                      </span>
                      <span className="text-2xl font-black text-emerald-400">
                        {filteredHistoryOrders.filter((o) => o.status === "delivered").length}
                      </span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Out of Stock / Cancelled
                      </span>
                      <span className="text-2xl font-black text-rose-400">
                        {filteredHistoryOrders.filter((o) => o.status === "out_of_stock" || o.status === "cancelled").length}
                      </span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        In Progress
                      </span>
                      <span className="text-2xl font-black text-indigo-400">
                        {filteredHistoryOrders.filter((o) => o.status !== "delivered" && o.status !== "cancelled" && o.status !== "out_of_stock").length}
                      </span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Total Revenue
                      </span>
                      <span className="text-2xl font-black text-amber-400">
                        ₹{filteredHistoryOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0).toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Multi-Criteria Filtering Controls */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                          placeholder="Search order #, student, room..."
                          className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none text-white focus:border-indigo-500"
                        />
                      </div>

                      {/* Date Range Filter */}
                      <select
                        value={historyDateFilter}
                        onChange={(e) => setHistoryDateFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                      >
                        <option value="all">📅 All Time Records</option>
                        <option value="today">Today's Orders</option>
                        <option value="yesterday">Yesterday's Orders</option>
                        <option value="this_week">Past 7 Days</option>
                      </select>

                      {/* Hostel Block Filter */}
                      <select
                        value={historyBuildingFilter}
                        onChange={(e) => setHistoryBuildingFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                      >
                        <option value="all">🏢 All Hostel Blocks</option>
                        <option value="N Block">N Block</option>
                        <option value="A Block">A Block</option>
                        <option value="H Block">H Block</option>
                        <option value="U Block">U Block</option>
                        <option value="Lara">Lara</option>
                        <option value="Pharmacy">Pharmacy</option>
                      </select>

                      {/* Courier Filter */}
                      <select
                        value={historyCourierFilter}
                        onChange={(e) => setHistoryCourierFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                      >
                        <option value="all">🚚 All Delivery Couriers</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-850 pt-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                        Status Filter:
                      </span>
                      {[
                        { id: "all", label: "All Statuses" },
                        { id: "delivered", label: "Delivered" },
                        { id: "received", label: "Received" },
                        { id: "preparing", label: "Preparing" },
                        { id: "packed", label: "Packed" },
                        { id: "out_for_delivery", label: "Out for Delivery" },
                        { id: "out_of_stock", label: "Out of Stock" },
                        { id: "cancelled", label: "Cancelled" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setHistoryStatusFilter(tab.id)}
                          className={`text-xs font-extrabold px-3 py-1 rounded-xl transition ${historyStatusFilter === tab.id
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                            }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* History Data Table View */}
                  {historyViewMode === "table" ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-850 bg-slate-950 text-slate-400 uppercase font-black tracking-wider text-[9px]">
                              <th className="p-4">Order # & Timestamp</th>
                              <th className="p-4">Student Info & Location</th>
                              <th className="p-4">Food & Print Summary</th>
                              <th className="p-4">Delivery Window & Slot</th>
                              <th className="p-4">Assigned Courier</th>
                              <th className="p-4 text-right">Amount & Status</th>
                              <th className="p-4 text-center">Receipt & Slip</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredHistoryOrders.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="p-12 text-center text-slate-500 font-semibold"
                                >
                                  No historical orders found matching the filter criteria.
                                </td>
                              </tr>
                            ) : (
                              filteredHistoryOrders.map((order) => (
                                <tr
                                  key={order.id}
                                  className="border-b border-slate-850 hover:bg-slate-850/30 transition"
                                >
                                  <td className="p-4">
                                    <div className="font-mono text-sm font-black text-indigo-400">
                                      #{order.order_number}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      {new Date(order.created_at).toLocaleString()}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="font-bold text-white text-sm">
                                      {order.student_name}
                                    </div>
                                    <div className="text-slate-350 text-xs font-semibold">
                                      Room {order.room_number}, {order.building} (Fl {order.floor})
                                    </div>
                                    <div className="text-slate-500 text-[10px]">
                                      Ph: {order.student_phone}
                                    </div>
                                  </td>
                                  <td className="p-4 max-w-xs">
                                    <div className="font-semibold text-slate-200 truncate">
                                      {order.items_summary || "No food items"}
                                    </div>
                                    {order.print_jobs_summary && (
                                      <div className="text-amber-300 text-[10px] font-bold mt-1 flex items-center">
                                        <Printer className="w-3 h-3 inline mr-1 shrink-0 text-amber-400" />
                                        <span>{order.print_jobs_summary}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-4">
                                    <span className="text-xs text-indigo-300 font-semibold">
                                      {order.slot_name
                                        ? `${order.slot_name} (${order.slot_delivery_start}–${order.slot_delivery_end})`
                                        : "Standard Delivery"}
                                    </span>
                                  </td>
                                  <td className="p-4">
                                    <span className="text-xs text-slate-300 font-medium">
                                      {order.delivery_partner_name || "Unassigned"}
                                    </span>
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="font-black text-amber-400 text-sm">
                                      ₹{order.total_amount.toFixed(0)}
                                    </div>
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase mt-1 ${order.status === "delivered"
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                                          : order.status === "out_of_stock" || order.status === "cancelled"
                                            ? "bg-red-950 text-red-400 border border-red-500/20"
                                            : "bg-indigo-950 text-indigo-300 border border-indigo-500/20"
                                        }`}
                                    >
                                      {order.status.replace(/_/g, " ")}
                                    </span>
                                  </td>
                                  <td className="p-4 text-center">
                                    <div className="inline-flex space-x-1.5">
                                      <button
                                        onClick={() => setInspectedOrder(order)}
                                        className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-indigo-400 p-2 rounded-xl transition"
                                        title="Inspect Receipt Dossier"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handlePrintReceipt(order)}
                                        className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-400 p-2 rounded-xl transition"
                                        title="Print Receipt Slip"
                                      >
                                        <Printer className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* History Grid Cards View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredHistoryOrders.map((order) => (
                        <div
                          key={order.id}
                          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-mono text-[10px] font-black text-indigo-400 block uppercase tracking-widest">
                                #{order.order_number}
                              </span>
                              <h4 className="font-black text-sm text-white mt-1">
                                {order.student_name}
                              </h4>
                              <span className="text-[10px] text-slate-500">
                                {new Date(order.created_at).toLocaleString()}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${order.status === "delivered"
                                  ? "bg-emerald-950 text-emerald-400"
                                  : order.status === "out_of_stock" || order.status === "cancelled"
                                    ? "bg-red-950 text-red-400"
                                    : "bg-indigo-950 text-indigo-400"
                                }`}
                            >
                              {order.status.replace(/_/g, " ")}
                            </span>
                          </div>

                          <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-850 text-xs">
                            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                              Items Summary
                            </span>
                            <p className="text-slate-200 font-extrabold">
                              {order.items_summary || "No items"}
                            </p>
                            {order.print_jobs_summary && (
                              <p className="text-[11px] text-amber-300 font-semibold mt-2">
                                🖨️ {order.print_jobs_summary}
                              </p>
                            )}
                          </div>

                          <div className="text-xs text-slate-400 space-y-1">
                            <div>Room {order.room_number}, {order.building} (Floor {order.floor})</div>
                            <div className="text-indigo-300 font-semibold">
                              {order.slot_name ? `Slot: ${order.slot_name}` : "Standard Delivery"}
                            </div>
                            <div className="text-slate-500">Courier: {order.delivery_partner_name || "Unassigned"}</div>
                          </div>

                          <div className="border-t border-slate-850 pt-3 flex justify-between items-center">
                            <span className="text-sm font-black text-amber-400">
                              ₹{order.total_amount.toFixed(0)}
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handlePrintReceipt(order)}
                                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print</span>
                              </button>
                              <button
                                onClick={() => setInspectedOrder(order)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Receipt</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab pickups: Counter Pickups for students marked Not Present */}
              {activeTab === "pickups" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
                    <h3 className="text-lg font-black text-white">
                      Canteen Counter Pickups (Not Present Queue)
                    </h3>
                    <div className="text-xs text-slate-400 font-medium">
                      Students who were not present for courier pickup will
                      collect their food here in-person.
                    </div>
                  </div>

                  {pickupOrders.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-550 font-bold shadow">
                      No counter pickup orders currently waiting.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pickupOrders.map((order) => (
                        <div
                          key={order.id}
                          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex flex-col justify-between space-y-4 relative overflow-hidden"
                        >
                          {/* Alert strip indicator */}
                          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />

                          {/* Header info */}
                          <div className="flex justify-between items-start pt-1">
                            <div>
                              <span className="font-mono text-[9px] font-extrabold text-amber-500 uppercase tracking-widest block">
                                Counter pickup
                              </span>
                              <h4 className="font-black text-sm text-white mt-1">
                                {order.student_name}
                              </h4>
                              <span className="text-[10px] text-slate-500 font-semibold">
                                {order.student_phone}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-amber-950 text-amber-400 border border-amber-500/20">
                              Not Present
                            </span>
                          </div>

                          {/* Items summary */}
                          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-850">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Items to Handover
                            </span>
                            <p className="text-xs text-slate-200 font-extrabold leading-relaxed">
                              {order.items_summary || "No items listed"}
                            </p>
                            {order.print_jobs_summary && (
                              <p className="text-[11px] text-amber-300 font-semibold mt-2 leading-relaxed">
                                {order.print_jobs_summary}
                              </p>
                            )}
                          </div>

                          {/* Previous Location */}
                          <div className="text-xs text-slate-400 space-y-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
                              Original Address
                            </span>
                            <span>
                              Room {order.room_number}, {order.building} (Floor{" "}
                              {order.floor})
                            </span>
                            <span className="block text-indigo-300 font-semibold">
                              {order.slot_name
                                ? `Slot: ${order.slot_name} (${order.slot_delivery_start}–${order.slot_delivery_end})`
                                : "No slot assigned"}
                            </span>
                          </div>

                          {/* Footer */}
                          <div className="border-t border-slate-850 pt-4 flex flex-col space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                Paid amount
                              </span>
                              <span className="text-sm font-black text-amber-400">
                                ₹{order.total_amount.toFixed(0)}
                              </span>
                            </div>

                            <button
                              onClick={() => handleDeliverOrder(order.id)}
                              className="w-full bg-emerald-650 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs transition duration-150 active:scale-[0.98]"
                            >
                              Complete Counter Handover
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Audit Log Trail */}
              {activeTab === "logs" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-black text-white">
                    Admin System Audit Trail
                  </h3>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 bg-slate-950 text-slate-400 uppercase font-black tracking-wider text-[9px]">
                            <th className="p-4">Timestamp</th>
                            <th className="p-4">Actor</th>
                            <th className="p-4">Action Event Details</th>
                            <th className="p-4">IP Address</th>
                            <th className="p-4">Browser Client / User-Agent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="p-8 text-center text-slate-500 font-semibold"
                              >
                                No audit logs recorded
                              </td>
                            </tr>
                          ) : (
                            auditLogs.map((log, idx) => (
                              <tr
                                key={idx}
                                className="border-b border-slate-850 hover:bg-slate-850/20"
                              >
                                <td className="p-4 text-slate-400 whitespace-nowrap">
                                  {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td className="p-4 font-bold text-white whitespace-nowrap">
                                  <div>{log.actor_role.toUpperCase()}</div>
                                  <div className="text-[9px] text-slate-550 font-mono font-normal mt-0.5">
                                    {log.actor_id.slice(0, 8)}...
                                  </div>
                                </td>
                                <td className="p-4 font-semibold text-slate-200">
                                  {log.action}
                                </td>
                                <td className="p-4 font-mono text-slate-400">
                                  {log.ip_address}
                                </td>
                                <td
                                  className="p-4 text-[10px] text-slate-500 max-w-xs truncate"
                                  title={log.user_agent}
                                >
                                  {log.user_agent}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 6: Delivery Partners list & history */}
              {activeTab === "partners" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-white">
                      Delivery Courier Roster
                    </h3>
                    <button
                      onClick={() => setShowAddPartner(true)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Onboard Partner</span>
                    </button>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 bg-slate-950 text-slate-400 uppercase font-black tracking-wider text-[9px]">
                            <th className="p-4">Courier Name</th>
                            <th className="p-4">Mobile Number</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4">Current Corridor Location</th>
                            <th className="p-4 text-right">
                              Details & History
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {partners.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="p-8 text-center text-slate-500 font-semibold"
                              >
                                No delivery partners onboarded
                              </td>
                            </tr>
                          ) : (
                            partners.map((partner) => (
                              <tr
                                key={partner.id}
                                className="border-b border-slate-850 hover:bg-slate-850/30 transition"
                              >
                                <td className="p-4">
                                  <div className="font-bold text-white text-sm">
                                    {partner.name}
                                  </div>
                                </td>
                                <td className="p-4 text-slate-300 font-medium">
                                  {partner.mobile_number}
                                </td>
                                <td className="p-4 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${partner.is_online
                                        ? "bg-emerald-950 text-emerald-400"
                                        : "bg-slate-950 text-slate-400"
                                      }`}
                                  >
                                    {partner.is_online
                                      ? "Online (On Shift)"
                                      : "Offline"}
                                  </span>
                                </td>
                                <td className="p-4">
                                  {partner.current_building ? (
                                    <div className="font-semibold text-slate-200">
                                      {partner.current_building}, Floor{" "}
                                      {partner.current_floor}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 italic text-[10px]">
                                      Idle / Off-duty
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 text-right">
                                  <button
                                    onClick={() => setInspectedPartner(partner)}
                                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold border border-indigo-500/35 px-2.5 py-1.5 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/10 transition"
                                  >
                                    Inspect history
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Student Details Inspector Modal */}
              {inspectedStudent && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto animate-fade-in"
                  >
                    <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-xs text-indigo-400 font-black uppercase tracking-wider">
                          Student Profile dossier
                        </span>
                        <h3 className="text-xl font-black text-white">
                          {inspectedStudent.short_name}
                        </h3>
                      </div>
                      <button
                        onClick={() => setInspectedStudent(null)}
                        className="bg-slate-950 border border-slate-800 p-1.5 rounded-lg text-slate-400 hover:text-white transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="bg-slate-950 rounded-2xl p-4 border border-slate-850 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-0.5">
                          Roll Number
                        </span>
                        <span className="font-bold text-white text-sm">
                          {inspectedStudent.roll_number}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">
                          Mobile Contact
                        </span>
                        <span className="font-semibold text-slate-350">
                          {inspectedStudent.mobile_number}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">
                          Joined Date
                        </span>
                        <span className="text-slate-400">
                          {new Date(
                            inspectedStudent.registered_at,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">
                          Verification Status
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block capitalize ${inspectedStudent.verification_status === "verified"
                              ? "bg-emerald-950 text-emerald-400"
                              : inspectedStudent.verification_status ===
                                "rejected"
                                ? "bg-red-950 text-red-400"
                                : "bg-slate-950 text-slate-400"
                            }`}
                        >
                          {inspectedStudent.verification_status}
                        </span>
                      </div>
                    </div>

                    {/* Tab Navigation inside Dossier */}
                    <div className="flex border-b border-slate-800">
                      <button
                        onClick={() => setInspectedStudentTab("id_card")}
                        className={`px-4 py-2 font-bold text-xs border-b-2 transition ${inspectedStudentTab === "id_card"
                            ? "border-indigo-500 text-indigo-400"
                            : "border-transparent text-slate-400 hover:text-white"
                          }`}
                      >
                        ID Card & OCR Verification
                      </button>
                      <button
                        onClick={() => setInspectedStudentTab("orders")}
                        className={`px-4 py-2 font-bold text-xs border-b-2 transition ${inspectedStudentTab === "orders"
                            ? "border-indigo-500 text-indigo-400"
                            : "border-transparent text-slate-400 hover:text-white"
                          }`}
                      >
                        Order History
                      </button>
                    </div>

                    {inspectedStudentTab === "id_card" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        {inspectedStudent.id_card_url ? (
                          <div className="space-y-2">
                            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                              Captured ID Photo (Cloudinary)
                            </span>
                            <div className="border border-slate-800 rounded-2xl overflow-hidden h-48 bg-slate-950 flex items-center justify-center relative shadow-inner">
                              <img
                                src={inspectedStudent.id_card_url}
                                alt="College ID Card"
                                className="w-full h-full object-cover"
                              />
                              <a
                                href={inspectedStudent.id_card_url}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur border border-slate-800 text-[10px] px-2.5 py-1 rounded text-indigo-400 font-bold hover:text-white transition"
                              >
                                View Full Image ↗
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-xs italic flex flex-col justify-center h-48">
                            No ID photo uploaded
                          </div>
                        )}

                        <div className="space-y-4">
                          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                            Fuzzy OCR Check Results
                          </span>
                          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 text-xs">
                            <div className="flex justify-between pb-2 border-b border-slate-900">
                              <span className="text-slate-500">
                                Similarity Fuzzy Score:
                              </span>
                              <span className="font-mono font-bold text-indigo-400 text-sm">
                                {inspectedStudent.name_similarity_score
                                  ? `${inspectedStudent.name_similarity_score.toFixed(1)}%`
                                  : "0.0%"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                Extracted Name:
                              </span>
                              <span className="font-semibold text-slate-200">
                                {inspectedStudent.ocr_extracted_name || "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                Extracted Roll:
                              </span>
                              <span className="font-semibold text-slate-300 font-mono">
                                {inspectedStudent.ocr_extracted_roll_number ||
                                  "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                Confidence Level:
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-black capitalize ${inspectedStudent.confidence_level === "high"
                                    ? "bg-emerald-950 text-emerald-400"
                                    : inspectedStudent.confidence_level ===
                                      "medium"
                                      ? "bg-amber-950 text-amber-400"
                                      : "bg-red-950 text-red-400"
                                  }`}
                              >
                                {inspectedStudent.confidence_level || "low"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {inspectedStudentTab === "orders" && (
                      <div className="space-y-4 animate-fade-in">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                          All Orders Placement History
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                          {orders.filter(
                            (o) => o.student_id === inspectedStudent.id,
                          ).length === 0 ? (
                            <div className="col-span-2 text-center py-12 bg-slate-950/40 border border-slate-800 rounded-2xl text-slate-500 text-xs italic">
                              No orders placed yet
                            </div>
                          ) : (
                            orders
                              .filter(
                                (o) => o.student_id === inspectedStudent.id,
                              )
                              .map((o) => (
                                <div
                                  key={o.id}
                                  className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2 hover:border-slate-800 transition"
                                >
                                  <div className="flex justify-between text-xs font-bold">
                                    <span className="text-indigo-400 font-mono">
                                      #{o.order_number}
                                    </span>
                                    <span className="text-amber-400">
                                      ₹{o.total_amount.toFixed(0)}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                                    {o.items_summary}
                                  </div>
                                  <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                                    <span>
                                      {new Date(
                                        o.created_at,
                                      ).toLocaleDateString()}
                                    </span>
                                    <span
                                      className={`capitalize font-bold ${o.status === "delivered"
                                          ? "text-emerald-400"
                                          : o.status === "cancelled"
                                            ? "text-red-400"
                                            : "text-amber-400"
                                        }`}
                                    >
                                      {o.status.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </div>
              )}

              {/* Delivery Partner Details Inspector Modal */}
              {inspectedPartner && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto animate-fade-in"
                  >
                    <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-xs text-indigo-400 font-black uppercase tracking-wider">
                          Delivery Agent Dossier
                        </span>
                        <h3 className="text-xl font-black text-white">
                          {inspectedPartner.name}
                        </h3>
                      </div>
                      <button
                        onClick={() => setInspectedPartner(null)}
                        className="bg-slate-950 border border-slate-800 p-1.5 rounded-lg text-slate-400 hover:text-white transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wide">
                          Courier Status Info
                        </h4>
                        <div className="bg-slate-950 rounded-2xl p-4 border border-slate-850 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-550 flex items-center">
                              Contact Number:
                            </span>{" "}
                            <span className="font-semibold text-slate-350">
                              {inspectedPartner.mobile_number}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-550">
                              Duty Shift Status:
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold ${inspectedPartner.is_online
                                  ? "bg-emerald-950 text-emerald-400"
                                  : "bg-slate-950 text-slate-400"
                                }`}
                            >
                              {inspectedPartner.is_online
                                ? "Online (On Shift)"
                                : "Offline"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-550">
                              Corridor Location:
                            </span>
                            <span className="font-semibold text-white text-xs">
                              {inspectedPartner.current_building
                                ? `${inspectedPartner.current_building}, Floor ${inspectedPartner.current_floor}`
                                : "Off-duty / Idle"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wide">
                          Assigned Delivery History
                        </h4>
                        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                          {orders.filter(
                            (o) =>
                              o.delivery_partner_name === inspectedPartner.name,
                          ).length === 0 ? (
                            <div className="text-center py-12 bg-slate-950/40 border border-slate-850 rounded-2xl text-slate-550 text-xs italic">
                              No deliveries completed or assigned yet
                            </div>
                          ) : (
                            orders
                              .filter(
                                (o) =>
                                  o.delivery_partner_name ===
                                  inspectedPartner.name,
                              )
                              .map((o) => (
                                <div
                                  key={o.id}
                                  className="bg-slate-950 border border-slate-850 p-3 rounded-xl space-y-1.5 animate-fade-in"
                                >
                                  <div className="flex justify-between text-xs font-bold">
                                    <span className="text-indigo-400 font-mono">
                                      #{o.order_number}
                                    </span>
                                    <span className="text-slate-300">
                                      Room {o.room_number}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-[10px] text-slate-450">
                                    <span>
                                      {new Date(
                                        o.created_at,
                                      ).toLocaleDateString()}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded font-bold ${o.status === "delivered"
                                          ? "text-emerald-400 bg-emerald-950/20"
                                          : "text-amber-400 bg-amber-950/20"
                                        }`}
                                    >
                                      {o.status.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Add Partner Overlay */}
              {showAddPartner && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-4"
                  >
                    <h3 className="text-sm font-black text-white border-b border-slate-850 pb-2">
                      Onboard Courier Partner
                    </h3>
                    <form
                      onSubmit={handleCreatePartner}
                      className="space-y-3.5"
                    >
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Partner Full Name
                        </label>
                        <input
                          type="text"
                          value={newPartnerName}
                          onChange={(e) => setNewPartnerName(e.target.value)}
                          placeholder="Anil Kumar"
                          required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Mobile number
                        </label>
                        <input
                          type="tel"
                          value={newPartnerMobile}
                          onChange={(e) => setNewPartnerMobile(e.target.value)}
                          placeholder="9876543210"
                          required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Credential Password
                        </label>
                        <input
                          type="password"
                          value={newPartnerPass}
                          onChange={(e) => setNewPartnerPass(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                        />
                      </div>
                      <div className="flex space-x-2 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowAddPartner(false)}
                          className="w-1/3 bg-slate-950 border border-slate-850 text-slate-400 text-xs py-2 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={partnerSaving}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-lg"
                        >
                          {partnerSaving ? "Saving..." : "Onboard Partner"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* Tab 7: Push Notifications */}
              {activeTab === "notifications" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-black text-white">
                    <Bell className="w-5 h-5 inline mr-2 text-indigo-400" />
                    Push Notifications
                  </h3>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <form onSubmit={handleSendNotification} className="space-y-6 max-w-2xl">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Audience</label>
                        <select
                          value={notificationTarget}
                          onChange={(e) => setNotificationTarget(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-indigo-500 transition-colors"
                        >
                          <option value="ALL">All Registered Students (with App)</option>
                          {students.map((st) => (
                            <option key={st.id} value={st.id}>Student: {st.name} ({st.roll_number})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notification Title (include Emojis! 🚀)</label>
                        <input
                          type="text"
                          required
                          value={notificationTitle}
                          onChange={(e) => setNotificationTitle(e.target.value)}
                          placeholder="e.g. Free Snacks! 🍟"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message Body</label>
                        <textarea
                          required
                          rows={4}
                          value={notificationBody}
                          onChange={(e) => setNotificationBody(e.target.value)}
                          placeholder="Write your custom message here..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-indigo-500 transition-colors resize-none"
                        ></textarea>
                      </div>

                      <button
                        type="submit"
                        disabled={notificationSending}
                        className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {notificationSending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <MessageSquare className="w-5 h-5" />
                            <span>Send Push Notification</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Order Receipt & Invoice Dossier Modal */}
              {inspectedOrder && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-indigo-400 font-mono font-black uppercase tracking-wider">
                            Order Dossier & Receipt
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${inspectedOrder.status === "delivered"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                                : inspectedOrder.status === "out_of_stock" || inspectedOrder.status === "cancelled"
                                  ? "bg-red-950 text-red-400 border border-red-500/20"
                                  : "bg-indigo-950 text-indigo-300 border border-indigo-500/20"
                              }`}
                          >
                            {inspectedOrder.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <h3 className="text-2xl font-black text-white font-mono mt-1">
                          #{inspectedOrder.order_number}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Placed on {new Date(inspectedOrder.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePrintReceipt(inspectedOrder)}
                          className="bg-slate-950 border border-slate-800 text-amber-400 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Print Slip</span>
                        </button>
                        <button
                          onClick={() => setInspectedOrder(null)}
                          className="bg-slate-950 border border-slate-800 p-1.5 rounded-xl text-slate-400 hover:text-white transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Lifecycle Progress Bar */}
                    <div className="bg-slate-950 rounded-2xl p-4 border border-slate-850 space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Order Lifecycle Status Progress
                      </span>
                      <div className="flex items-center justify-between text-xs font-bold pt-1">
                        {[
                          { id: "received", label: "Received" },
                          { id: "preparing", label: "Preparing" },
                          { id: "packed", label: "Packed" },
                          { id: "out_for_delivery", label: "Out for Delivery" },
                          { id: "delivered", label: "Delivered" },
                        ].map((step, idx, arr) => {
                          const stepsOrder = ["received", "preparing", "packed", "assigned", "out_for_delivery", "delivered"];
                          const currentIdx = stepsOrder.indexOf(inspectedOrder.status);
                          const stepIdx = stepsOrder.indexOf(step.id);
                          const isDone = currentIdx >= stepIdx && inspectedOrder.status !== "cancelled" && inspectedOrder.status !== "out_of_stock";
                          return (
                            <React.Fragment key={step.id}>
                              <div className="flex flex-col items-center space-y-1">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${isDone
                                      ? "bg-emerald-600 text-white"
                                      : inspectedOrder.status === "cancelled" || inspectedOrder.status === "out_of_stock"
                                        ? "bg-red-950 text-red-400 border border-red-800"
                                        : "bg-slate-800 text-slate-500"
                                    }`}
                                >
                                  {isDone ? "✓" : idx + 1}
                                </div>
                                <span className={`text-[9px] ${isDone ? "text-emerald-400 font-bold" : "text-slate-500"}`}>
                                  {step.label}
                                </span>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-1 ${isDone ? "bg-emerald-600" : "bg-slate-800"}`} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Customer & Courier Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Customer Info */}
                      <div className="bg-slate-950 rounded-2xl p-4 border border-slate-850 space-y-2 text-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Student Information & Address
                        </span>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Student Name:</span>
                          <span className="font-bold text-white">{inspectedOrder.student_name || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Mobile Contact:</span>
                          <span className="font-semibold text-slate-200">{inspectedOrder.student_phone || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Hostel Address:</span>
                          <span className="font-bold text-indigo-300">
                            Room {inspectedOrder.room_number}, {inspectedOrder.building} (Floor {inspectedOrder.floor})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Delivery Slot:</span>
                          <span className="font-semibold text-slate-300">
                            {inspectedOrder.slot_name
                              ? `${inspectedOrder.slot_name} (${inspectedOrder.slot_delivery_start}–${inspectedOrder.slot_delivery_end})`
                              : "Standard Delivery"}
                          </span>
                        </div>
                      </div>

                      {/* Courier & Payment Info */}
                      <div className="bg-slate-950 rounded-2xl p-4 border border-slate-850 space-y-2 text-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Logistics Courier & Payment
                        </span>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Assigned Courier:</span>
                          <span className="font-bold text-teal-400">{inspectedOrder.delivery_partner_name || "Unassigned"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Payment Status:</span>
                          <span className="font-bold text-emerald-400 uppercase">{inspectedOrder.payment_status || "PAID (Razorpay)"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Counter Pickup Flag:</span>
                          <span className={`font-bold ${inspectedOrder.not_available_flag ? "text-rose-400" : "text-slate-400"}`}>
                            {inspectedOrder.not_available_flag ? "Yes (Not Present)" : "No (Normal Doorstep)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Food Items Breakdown */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Line Items Breakdown
                      </span>
                      <div className="bg-slate-950 rounded-2xl border border-slate-850 p-4 space-y-2">
                        {inspectedOrder.items && inspectedOrder.items.length > 0 ? (
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-850 text-slate-500 uppercase text-[9px] font-bold">
                                <th className="pb-2">Product Name</th>
                                <th className="pb-2 text-center">Qty</th>
                                <th className="pb-2 text-right">Unit Price</th>
                                <th className="pb-2 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inspectedOrder.items.map((item: any, idx: number) => (
                                <tr key={idx} className="border-b border-slate-900/50">
                                  <td className="py-2 font-bold text-white">{item.product_name || "Food Item"}</td>
                                  <td className="py-2 text-center font-mono font-bold text-indigo-300">x{item.quantity}</td>
                                  <td className="py-2 text-right text-slate-400">₹{item.unit_price}</td>
                                  <td className="py-2 text-right font-black text-amber-400">₹{item.quantity * item.unit_price}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="text-xs text-slate-200 font-extrabold">
                            {inspectedOrder.items_summary || "No items listed"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Print Jobs Section if present */}
                    {inspectedOrder.print_jobs && inspectedOrder.print_jobs.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block flex items-center space-x-1">
                          <Printer className="w-3.5 h-3.5 inline mr-1" />
                          <span>Attached Print Documents ({inspectedOrder.print_jobs.length})</span>
                        </span>
                        <div className="space-y-2">
                          {inspectedOrder.print_jobs.map((pj: any, idx: number) => (
                            <div key={idx} className="bg-slate-950 border border-amber-500/20 rounded-2xl p-3 flex justify-between items-center text-xs">
                              <div>
                                <div className="font-bold text-white flex items-center space-x-1.5">
                                  <span>📄 {pj.file_name}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                  📋 <span className="text-amber-400 font-extrabold">{pj.copies} {pj.copies === 1 ? "Copy" : "Copies"}</span> • {pj.page_count} pages • {pj.color_mode.toUpperCase()} • {pj.sides === "double" ? "Double Sided" : "Single Sided"}
                                </div>
                              </div>
                              <a
                                href={pj.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl font-bold text-[10px] flex items-center space-x-1 transition"
                              >
                                <span>Open File</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Financial Summary */}
                    <div className="bg-slate-950 rounded-2xl p-4 border border-slate-850 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Grand Total Paid</span>
                        <span className="text-xs text-slate-400">Includes delivery fee & print charges</span>
                      </div>
                      <span className="text-3xl font-black text-amber-400 font-mono">
                        ₹{inspectedOrder.total_amount.toFixed(0)}
                      </span>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handlePrintReceipt(inspectedOrder)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print Invoice Slip</span>
                      </button>
                      <button
                        onClick={() => setInspectedOrder(null)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold"
                      >
                        Close Details
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Toast Notification */}
              {toast && (
                <div
                  className={`fixed bottom-5 right-5 z-[100] px-5 py-3 rounded-xl shadow-lg font-bold text-xs flex items-center space-x-2 text-white animate-pulse ${toast.type === "success" ? "bg-emerald-600" : "bg-red-650"
                    }`}
                >
                  <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>{toast.message}</span>
                </div>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
