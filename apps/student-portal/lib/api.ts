import { Student, Product, Category, Order, PrintPricing, PrintColorMode, PrintSides, TrackingAd, HostelBlock } from "@campusbites/types";

const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim();
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8080/api/student";
    }
  }

  return "https://invalidurl.onrender.com/api/student";
};

const API_BASE_URL = getApiBaseUrl();

// Get token from localStorage
export const getToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("student_token");
  }
  return null;
};

// Set token and student to localStorage
export const setSession = (token: string, student: Student) => {
  localStorage.setItem("student_token", token);
  localStorage.setItem("student_profile", JSON.stringify(student));
};

// Get profile from localStorage
export const getProfile = (): Student | null => {
  if (typeof window !== "undefined") {
    const profile = localStorage.getItem("student_profile");
    return profile ? JSON.parse(profile) : null;
  }
  return null;
};

// Logout
export const logout = () => {
  localStorage.removeItem("student_token");
  localStorage.removeItem("student_profile");
};

let isHandling401 = false;

// Generic fetch wrapper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new Error(
      `Backend connection offline or unreachable at ${API_BASE_URL}`
    );
  }

  if (response.status === 401) {
    if (token || isHandling401) {
      logout();
      if (!isHandling401 && typeof window !== "undefined") {
        isHandling401 = true;
        window.location.reload();
      }
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData.error || errorData.message || `HTTP error! status: ${response.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return response.json();
}

// Student APIs
export const studentApi = {
  // Mobile login for returning students
  login: (mobileNumber: string) =>
    apiRequest<{ token: string; student: Student }>("/login", {
      method: "POST",
      body: JSON.stringify({ mobile_number: mobileNumber }),
    }),

  // Registration + OCR
  register: (data: {
    mobile_number: string;
    short_name: string;
    roll_number: string;
    id_card_url: string;
  }) =>
    apiRequest<{ token: string; student: Student }>("/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  previewOcr: (data: {
    short_name: string;
    roll_number: string;
    id_card_url: string;
  }) =>
    apiRequest<{
      extracted_name: string;
      extracted_roll: string;
      similarity_score: number;
      confidence: string;
    }>("/ocr/preview", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Get categorized menu
  getMenu: () =>
    apiRequest<{ categories: Category[]; products: Product[] }>("/menu"),

  // Place a new order (food and/or print jobs)
  createOrder: (data: {
    room_number: string;
    building: string;
    floor: number;
    special_instructions: string;
    delivery_slot_id: string;
    items: { product_id: string; quantity: number }[];
    print_jobs?: {
      file_url: string;
      file_name: string;
      file_type: string;
      color_mode: PrintColorMode;
      sides: PrintSides;
      page_count: number;
      copies: number;
    }[];
  }) =>
    apiRequest<{
      order_id: string;
      order_number: string;
      total_amount: number;
      razorpay_order_id: string;
      razorpay_key_id?: string;
      status?: string;
      message?: string;
    }>("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPrintPricing: () => apiRequest<PrintPricing>("/print-pricing"),

  getTrackingAd: () => apiRequest<TrackingAd>("/tracking-ad"),

  // Verify payment
  verifyPayment: (data: {
    order_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    apiRequest<{ message: string }>("/payments/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPaymentStatus: (id: string) =>
    apiRequest<{ payment_status: string; order_status: string }>(
      `/orders/${id}/payment-status`,
    ),

  cancelUnpaidOrder: (id: string) =>
    apiRequest<{ message: string }>(`/orders/${id}/cancel-unpaid`, {
      method: "POST",
    }),

  // Track active order
  trackOrder: (id: string) =>
    apiRequest<{
      order: Order;
      payment_status: string;
      delivery_partner: {
        name: string;
        phone: string;
        current_building: string;
        current_floor: number;
      } | null;
      history: { status: string; timestamp: string }[];
      queue_position: number;
      eta_minutes: number;
    }>(`/orders/${id}/track`),

  // Order history
  getHistory: () => apiRequest<Order[]>("/orders/history"),

  getCutoff: () => apiRequest<{ cutoff_time: string }>("/cutoff"),

  getDeliverySlots: () =>
    apiRequest<
      {
        id: string;
        name: string;
        delivery_start: string;
        delivery_end: string;
        order_cutoff: string;
        is_active: boolean;
        is_ordering_open: boolean;
      }[]
    >("/delivery-slots"),

  saveFCMToken: (token: string) =>
    apiRequest<{ message: string }>("/fcm-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  getPrivacy: () => apiRequest<{ accepted: boolean }>("/privacy"),

  acceptPrivacy: () =>
    apiRequest<{ message: string }>("/privacy/accept", {
      method: "POST",
    }),

  getCart: () => apiRequest<{ items: { product_id: string; quantity: number }[] }>("/cart"),

  updateCart: (items: { product_id: string; quantity: number }[]) =>
    apiRequest<{ status: string; items: { product_id: string; quantity: number }[] }>("/cart", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  mergeCart: (items: { product_id: string; quantity: number }[]) =>
    apiRequest<{ status: string; items: { product_id: string; quantity: number }[] }>("/cart/merge", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  getDeliveryConfig: () =>
    apiRequest<{ delivery_fee: number; min_free_delivery_amount: number }>("/delivery-config"),

  getMenuSchedules: () => apiRequest<import("@campusbites/types").MenuSchedule[]>("/menu-schedules"),

  submitReview: (orderId: string, rating: number, review: string) =>
    apiRequest<{ status: string; message: string }>(`/orders/${orderId}/review`, {
      method: "POST",
      body: JSON.stringify({ rating, review }),
    }),

  getHostelBlocks: () => apiRequest<HostelBlock[]>("/hostel-blocks"),
};



