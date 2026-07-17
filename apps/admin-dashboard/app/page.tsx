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
} from "lucide-react";
import { adminApi, getToken, getProfile, logout, setSession } from "../lib/api";

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
    | "pickups"
    | "overview"
    | "products"
    | "students"
    | "partners"
    | "logs"
  >("orders");

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
  const [students, setStudents] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Forms and Modals
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("Snacks");
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
  const [cutoffTime, setCutoffTime] = useState("23:59");

  // Partner creation Form
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerMobile, setNewPartnerMobile] = useState("");
  const [newPartnerPass, setNewPartnerPass] = useState("");
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [showAddPartner, setShowAddPartner] = useState(false);

  // Search parameters
  const [studentSearch, setStudentSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

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
      }, 8000);
    }
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const fetchSummary = async () => {
    try {
      const data = await adminApi.getSummary();
      setSummary(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOrders = async () => {
    try {
      const data = await adminApi.getOrders();
      setOrders(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllData = async () => {
    try {
      setDataLoading(true);
      await fetchSummary();

      const prodData = await adminApi.getProducts();
      setProducts(prodData || []);

      const studentData = await adminApi.getStudents();
      setStudents(studentData || []);

      const partnerData = await adminApi.getPartners();
      setPartners(partnerData || []);

      await fetchOrders();

      const logData = await adminApi.getAuditLogs();
      setAuditLogs(logData || []);

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
    try {
      setProductSaving(true);

      // Look up category mapping (or seed mock ids)
      // Since seed categories creates Snacks/Beverages/Meals, we pass mock names
      // Our Go backend automatically accepts category name/id checks or maps it.
      // Let's create dummy category mapping matching seeded ones
      // Samosa category: "Snacks", Tea category: "Beverages", Burger category: "Meals"
      // We will map based on string matches
      let categoryId = "Snacks"; // Handled dynamically in backend seeding.

      await adminApi.createProduct({
        name: newProductName,
        category_id: newProductCategory, // will resolve to UUID in DB
        mrp: Number(newProductMrp || newProductPrice),
        selling_price: Number(newProductPrice),
        image_url: newProductImage,
      });

      showToast("Product catalog updated successfully.", "success");
      setNewProductName("");
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

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !editProductName || !editProductPrice) return;
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
        `Mark this order as Out of Stock? UPI Refund notice will be dispatched to student mobile: ${phone}`,
      )
    ) {
      try {
        await adminApi.cancelOrder(orderId);
        showToast(
          `Out of Stock: Refund initiated to student UPI (mobile: ${phone}).`,
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

  // Searching filters
  const filteredStudents = students.filter(
    (s) =>
      s.short_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(studentSearch.toLowerCase()),
  );

  const filteredOrders = orders.filter(
    (o) =>
      o.order_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.room_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.student_name.toLowerCase().includes(orderSearch.toLowerCase()),
  );

  const pickupOrders = orders.filter(
    (o) =>
      o.not_available_flag &&
      o.status !== "delivered" &&
      o.status !== "cancelled",
  );

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
        <div className="flex-1 flex flex-col md:flex-row min-h-screen">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
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

            <nav className="flex md:flex-col p-4 space-x-1.5 md:space-x-0 md:space-y-1.5 overflow-x-auto md:overflow-visible scrollbar-none">
              {[
                { id: "orders", label: "Dispatch Desk", icon: ShoppingBag },
                { id: "pickups", label: "Counter Pickups", icon: Clock },
                { id: "overview", label: "Overview Metrics", icon: TrendingUp },
                { id: "products", label: "Product Catalog", icon: Layers },
                { id: "students", label: "Verification Queue", icon: Users },
                {
                  id: "partners",
                  label: "Delivery Couriers",
                  icon: Navigation,
                },
                { id: "logs", label: "Audit Trail Logs", icon: ShieldAlert },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-auto md:w-full flex-shrink-0 flex items-center space-x-3 px-4 py-3 rounded-xl text-left font-bold text-xs transition ${
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

          {/* Main Content Workspace */}
          <main className="flex-1 flex flex-col bg-slate-950 min-w-0">
            {/* Top Workspace Header */}
            <header className="h-16 border-b border-slate-800 px-8 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="font-extrabold text-sm text-white capitalize">
                  {activeTab} Workspace
                </h2>
                {dataLoading && (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                )}
              </div>

              {/* Order Cutoff Time config widget */}
              <div className="hidden lg:flex items-center space-x-2 bg-slate-900 border border-slate-850 px-3 py-1 rounded-xl">
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
                  className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-300"
                  title="Reload metrics"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-400 font-medium">Logged in:</span>
                <span className="text-indigo-400 font-bold bg-indigo-950/30 border border-indigo-900/30 px-2 py-1 rounded">
                  {profile.name}
                </span>
              </div>
            </header>

            {/* Tab Workspace Panels */}
            <div className="flex-1 p-8 overflow-y-auto">
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
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                            >
                              {products.length > 0 &&
                                Array.from(
                                  new Set(products.map((p) => p.category_name)),
                                ).map((catName) => (
                                  <option
                                    key={catName}
                                    value={
                                      products.find(
                                        (p) => p.category_name === catName,
                                      ).category_id
                                    }
                                  >
                                    {catName}
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
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                            >
                              {products.length > 0 &&
                                Array.from(
                                  new Set(products.map((p) => p.category_name)),
                                ).map((catName) => (
                                  <option
                                    key={catName}
                                    value={
                                      products.find(
                                        (p) => p.category_name === catName,
                                      ).category_id
                                    }
                                  >
                                    {catName}
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
                              className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                p.is_available
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
                              className={`text-[9px] font-extrabold px-2 py-1 rounded transition ${
                                p.is_available
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
                                      className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                        student.confidence_level === "high"
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
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      student.verification_status === "verified"
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

              {/* Tab 4: Orders Dispatch Desk */}
              {activeTab === "orders" && (
                <div className="space-y-6">
                  {/* Action row with partner onboard button */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
                    <div className="flex items-center space-x-4">
                      <h3 className="text-lg font-black text-white">
                        Logistics & Dispatch Desk
                      </h3>
                      <button
                        onClick={() => setShowAddPartner(true)}
                        className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-350 text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Delivery Courier</span>
                      </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Search order or room..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs outline-none text-white focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Dispatch desk cards */}
                  {filteredOrders.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 font-semibold shadow">
                      No orders logged
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredOrders.map((order) => (
                        <div
                          key={order.id}
                          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex flex-col justify-between space-y-4 hover:border-slate-700 transition duration-200"
                        >
                          {/* Header info */}
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-mono text-[10px] font-black text-indigo-400 block tracking-widest uppercase">
                                Order #{order.order_number}
                              </span>
                              <h4 className="font-black text-sm text-white mt-1">
                                {order.student_name}
                              </h4>
                              <span className="text-[10px] text-slate-500 font-semibold">
                                {order.student_phone}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                order.payment_status === "paid"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                                  : "bg-red-950/60 text-red-400 border border-red-500/20"
                              }`}
                            >
                              {order.payment_status}
                            </span>
                          </div>

                          {/* Items summary */}
                          <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-850">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              Items to Send
                            </span>
                            <p className="text-xs text-slate-200 font-extrabold leading-relaxed">
                              {order.items_summary || "No items listed"}
                            </p>
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
                                Status
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  order.status === "delivered"
                                    ? "bg-emerald-950 text-emerald-400"
                                    : order.status === "out_for_delivery"
                                      ? "bg-teal-950 text-teal-400"
                                      : "bg-slate-950 text-slate-400"
                                }`}
                              >
                                {order.status.replace(/_/g, " ")}
                              </span>
                            </div>

                            {/* Actions block */}
                            <div className="pt-2 flex items-center justify-between gap-3">
                              {/* Left Out of Stock button */}
                              {order.status !== "delivered" &&
                                order.status !== "cancelled" && (
                                  <button
                                    onClick={() =>
                                      handleCancelOrder(
                                        order.id,
                                        order.student_phone,
                                      )
                                    }
                                    className="text-[9.5px] font-extrabold bg-red-950/60 hover:bg-red-950 text-red-400 px-3 py-2 rounded-xl transition border border-red-500/10 active:scale-95 duration-150"
                                  >
                                    Out of Stock
                                  </button>
                                )}

                              {/* Right Assign dropdown */}
                              {order.status === "received" ||
                              order.status === "preparing" ||
                              order.status === "packed" ? (
                                <select
                                  onChange={(e) =>
                                    handleAssignPartner(
                                      order.id,
                                      e.target.value,
                                    )
                                  }
                                  defaultValue=""
                                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-350 text-[10px] p-2 rounded-xl outline-none"
                                >
                                  <option value="" disabled>
                                    Assign Courier...
                                  </option>
                                  {partners
                                    .filter((p) => p.is_online)
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <div className="text-[10px] text-slate-550 font-semibold italic flex items-center space-x-1 py-1">
                                  <span>
                                    Assigned to:{" "}
                                    {order.delivery_partner_name || "Courier"}
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
                          </div>

                          {/* Previous Location */}
                          <div className="text-xs text-slate-400">
                            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
                              Original Address
                            </span>
                            <span>
                              Room {order.room_number}, {order.building} (Floor{" "}
                              {order.floor})
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
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      partner.is_online
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
                          className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block capitalize ${
                            inspectedStudent.verification_status === "verified"
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
                        className={`px-4 py-2 font-bold text-xs border-b-2 transition ${
                          inspectedStudentTab === "id_card"
                            ? "border-indigo-500 text-indigo-400"
                            : "border-transparent text-slate-400 hover:text-white"
                        }`}
                      >
                        ID Card & OCR Verification
                      </button>
                      <button
                        onClick={() => setInspectedStudentTab("orders")}
                        className={`px-4 py-2 font-bold text-xs border-b-2 transition ${
                          inspectedStudentTab === "orders"
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
                                className={`px-2 py-0.5 rounded text-[9px] font-black capitalize ${
                                  inspectedStudent.confidence_level === "high"
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
                                      className={`capitalize font-bold ${
                                        o.status === "delivered"
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
                              className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                inspectedPartner.is_online
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
                                      className={`px-1.5 py-0.2 rounded font-bold ${
                                        o.status === "delivered"
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

              {/* Toast Notification */}
              {toast && (
                <div
                  className={`fixed bottom-5 right-5 z-[100] px-5 py-3 rounded-xl shadow-lg font-bold text-xs flex items-center space-x-2 text-white animate-pulse ${
                    toast.type === "success" ? "bg-emerald-600" : "bg-red-650"
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
