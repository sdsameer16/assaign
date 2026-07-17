"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  MapPin,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  Calendar,
  User,
  UserCheck,
  ShieldAlert,
  Loader2,
  LogOut,
  TrendingUp,
  Check,
  Navigation,
  ClipboardList,
} from "lucide-react";
import { DeliveryOrderView } from "@campusbites/types";
import {
  deliveryApi,
  getToken,
  getProfile,
  logout,
  setSession,
} from "../lib/api";

export default function DeliveryPartnerApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Active delivery lists
  const [deliveries, setDeliveries] = useState<DeliveryOrderView[]>([]);
  const [stats, setStats] = useState({ pending: 0, delivered: 0 });
  const [history, setHistory] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrderView | null>(
    null,
  );

  // States for notes and updating
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"deliveries" | "history">(
    "deliveries",
  );

  // Verification states
  const [verificationCode, setVerificationCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  useEffect(() => {
    const savedToken = getToken();
    const savedProfile = getProfile();
    if (savedToken && savedProfile) {
      setToken(savedToken);
      setProfile(savedProfile);
      setIsLoggedIn(true);
      fetchDeliveries();
      fetchStats();
      fetchHistory();
    }
  }, []);

  // Poll deliveries list and stats periodically
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoggedIn) {
      interval = setInterval(() => {
        fetchDeliveries();
        fetchStats();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const fetchDeliveries = async () => {
    try {
      const data = await deliveryApi.getAssigned();
      setDeliveries(data || []);
    } catch (e) {
      console.error("Failed to load deliveries:", e);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await deliveryApi.getStats();
      setStats(data);
    } catch (e) {
      console.error("Failed to load stats:", e);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await deliveryApi.getHistory();
      setHistory(data || []);
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileNumber || !password) return;
    try {
      setLoginLoading(true);
      const data = await deliveryApi.login(mobileNumber, password);
      if (data.token && data.delivery_partner) {
        setSession(data.token, data.delivery_partner);
        setToken(data.token);
        setProfile(data.delivery_partner);
        setIsLoggedIn(true);
        fetchDeliveries();
        fetchStats();
        fetchHistory();
      }
    } catch (err: any) {
      alert("Login failed: " + err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setProfile(null);
    setToken(null);
    setSelectedOrder(null);
  };

  // State manipulation handlers
  const handleMarkDelivered = async (orderId: string) => {
    if (!selectedOrder) return;

    try {
      setActionLoading(true);
      if (confirm("Are you sure you want to mark this order as DELIVERED?")) {
        await deliveryApi.markDelivered(orderId);
        setSelectedOrder(null);
        fetchDeliveries();
        fetchStats();
        fetchHistory();
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkNotAvailable = async (orderId: string) => {
    if (confirm("Flag student as NOT AVAILABLE?")) {
      try {
        setActionLoading(true);
        await deliveryApi.markNotAvailable(orderId);
        setSelectedOrder(null);
        fetchDeliveries();
        fetchStats();
      } catch (e: any) {
        alert(e.message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleSaveNotes = async (orderId: string) => {
    try {
      setNotesSaving(true);
      await deliveryApi.updateNotes(orderId, deliveryNotes);
      alert("Delivery note updated.");
      if (selectedOrder) {
        setSelectedOrder({ ...selectedOrder, delivery_notes: deliveryNotes });
      }
      fetchDeliveries();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setNotesSaving(false);
    }
  };

  // Group deliveries by building and floor for walk sequence
  const groupedDeliveries = deliveries.reduce((groups: any, order) => {
    const key = `${order.building} - Floor ${order.floor}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(order);
    return groups;
  }, {});

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 py-4 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black">
            D
          </div>
          <div>
            <h1 className="font-extrabold text-sm leading-tight">
              CampusBites
            </h1>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Partner Portal
            </span>
          </div>
        </div>

        {isLoggedIn && (
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 flex flex-col">
        {/* Auth gateway */}
        {!isLoggedIn && (
          <div className="my-auto py-10">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-12 h-12 bg-emerald-600/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Navigation className="w-6 h-6 animate-pulse" />
                </div>
                <h2 className="text-2xl font-black">Partner Login</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Access assigned canteen corridor deliveries list
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) =>
                      setMobileNumber(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="9999988888"
                    required
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-600 rounded-xl outline-none text-white text-sm transition"
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
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-emerald-600 rounded-xl outline-none text-white text-sm transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-3.5 rounded-xl flex items-center justify-center space-x-2 text-sm transition"
                >
                  {loginLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>Login to Shift</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Dashboard once logged in */}
        {isLoggedIn && profile && (
          <div className="flex-1 flex flex-col">
            {/* Shift metrics panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 gap-4 mb-6">
              <div className="text-center border-r border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Pending
                </span>
                <span className="text-2xl font-black text-amber-500">
                  {stats.pending}
                </span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Completed Today
                </span>
                <span className="text-2xl font-black text-emerald-500">
                  {stats.delivered}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 bg-slate-900 p-1 rounded-xl mb-4 border border-slate-850">
              <button
                onClick={() => setActiveTab("deliveries")}
                className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${
                  activeTab === "deliveries"
                    ? "bg-slate-800 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Assigned ({deliveries.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${
                  activeTab === "history"
                    ? "bg-slate-800 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Shift Logs ({history.length})
              </button>
            </div>

            {/* List active assignments */}
            {activeTab === "deliveries" && (
              <div className="flex-1 space-y-6">
                {deliveries.length === 0 ? (
                  <div className="text-center py-20 text-slate-500 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 text-slate-650" />
                    <p className="text-xs font-semibold">
                      No orders assigned to you
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      Awaiting admin dispatch assignments.
                    </p>
                  </div>
                ) : (
                  Object.entries(groupedDeliveries).map(
                    ([groupKey, groupOrders]: any) => (
                      <div key={groupKey} className="space-y-2">
                        <div className="text-[10px] font-black text-slate-450 uppercase tracking-widest px-2 flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{groupKey}</span>
                        </div>

                        <div className="space-y-2">
                          {groupOrders.map((order: DeliveryOrderView) => (
                            <div
                              key={order.id}
                              onClick={() => {
                                setSelectedOrder(order);
                                setDeliveryNotes(order.delivery_notes || "");
                                setVerificationCode("");
                                setCodeError(false);
                              }}
                              className="bg-slate-900 border border-slate-850 hover:border-slate-800 p-4 rounded-xl flex items-center justify-between cursor-pointer active:scale-99 transition"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono font-black text-sm text-white">
                                    Room {order.room_number}
                                  </span>
                                  <span
                                    className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                      order.payment_status === "Paid"
                                        ? "bg-emerald-950 text-emerald-400"
                                        : "bg-amber-950 text-amber-400"
                                    }`}
                                  >
                                    {order.payment_status}
                                  </span>
                                </div>
                                <span className="text-slate-400 text-xs mt-1 block">
                                  Student: {order.student_name}
                                </span>
                                <span className="text-[10px] text-slate-500 block truncate">
                                  {order.items
                                    .map(
                                      (i) => `${i.product_name} x${i.quantity}`,
                                    )
                                    .join(", ")}
                                </span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-600" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>
            )}

            {/* Complete history tab */}
            {activeTab === "history" && (
              <div className="flex-1 space-y-2">
                {history.length === 0 ? (
                  <div className="text-center py-20 text-slate-500">
                    <p className="text-xs font-semibold">
                      No deliveries logged today
                    </p>
                  </div>
                ) : (
                  history.map((record, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 border border-slate-850 p-3 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white">
                            Room {record.room_number}
                          </span>
                          <span className="text-[10px] text-slate-550">
                            {record.building}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 block mt-0.5">
                          Assigned:{" "}
                          {new Date(record.assigned_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                        <Check className="w-3.5 h-3.5" />
                        <span>Delivered</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Order detail overlay */}
            <AnimatePresence>
              {selectedOrder && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-slate-950/85 flex flex-col justify-end"
                >
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto space-y-6"
                  >
                    {/* Drawer Header */}
                    <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest">
                          {selectedOrder.building} • Floor {selectedOrder.floor}
                        </span>
                        <h3 className="text-2xl font-black text-white mt-1">
                          Room {selectedOrder.room_number}
                        </h3>
                      </div>
                      <button
                        onClick={() => setSelectedOrder(null)}
                        className="bg-slate-800 text-slate-400 hover:text-white px-3 py-1 rounded-lg text-xs font-bold"
                      >
                        Close
                      </button>
                    </div>

                    {/* Student card & call link */}
                    <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-white">
                          {selectedOrder.student_name}
                        </h4>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Phone: {selectedOrder.student_phone}
                        </span>
                      </div>
                      <a
                        href={`tel:${selectedOrder.student_phone}`}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-full flex items-center justify-center shadow shadow-emerald-500/20 active:scale-95 transition"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>

                    {/* Items table */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Items list
                      </span>
                      <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-850 space-y-1.5">
                        {selectedOrder.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-xs"
                          >
                            <span className="text-slate-300 font-medium">
                              {item.product_name}
                            </span>
                            <span className="text-white font-extrabold">
                              x{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Special instruction text */}
                    {selectedOrder.special_instructions && (
                      <div className="bg-indigo-950/15 border border-indigo-900/40 rounded-xl p-3 text-xs flex items-start space-x-2">
                        <ClipboardList className="w-4 h-4 text-indigo-400 mt-0.5" />
                        <div>
                          <span className="font-bold text-indigo-300">
                            Student note:
                          </span>
                          <p className="text-slate-400 mt-0.5">
                            {selectedOrder.special_instructions}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Shift comments input */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Shift comments / Notes
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={deliveryNotes}
                          onChange={(e) => setDeliveryNotes(e.target.value)}
                          placeholder="e.g. door locked, hung on handle"
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none text-white"
                        />
                        <button
                          onClick={() => handleSaveNotes(selectedOrder.id)}
                          disabled={notesSaving}
                          className="bg-slate-800 hover:bg-slate-750 text-white font-bold px-4 py-2 rounded-lg text-xs"
                        >
                          {notesSaving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>

                    {/* Verification Code Display */}
                    <div className="space-y-2 bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                          Student Verification Code
                        </label>
                        <span className="text-[8px] text-indigo-400 font-extrabold uppercase bg-indigo-950/40 px-1.5 py-0.5 rounded animate-pulse">
                          Security Code Check
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center font-mono font-black text-lg tracking-widest text-white uppercase outline-none transition flex items-center justify-center">
                        CB-{selectedOrder.order_number.split("-")[1]}
                      </div>
                      <p className="text-[10px] text-slate-500 text-center px-4 leading-relaxed">
                        Visually verify this code with the student's screen before handing over the package.
                      </p>
                    </div>

                    {/* Action buttons (Delivered vs Missing) */}
                    <div className="flex space-x-3 pt-4 border-t border-slate-800">
                      <button
                        onClick={() => handleMarkNotAvailable(selectedOrder.id)}
                        disabled={actionLoading}
                        className="w-1/3 bg-amber-950 border border-amber-900/40 text-amber-400 py-3.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 hover:bg-amber-900/20"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Not Available</span>
                      </button>
                      <button
                        onClick={() => handleMarkDelivered(selectedOrder.id)}
                        disabled={actionLoading}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/20 active:scale-98 transition"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Confirm Delivered</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
