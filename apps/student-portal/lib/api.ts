import { Student, Product, Category, Order } from "@campusbites/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/student";

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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`,
    );
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

  // Get categorized menu
  getMenu: () =>
    apiRequest<{ categories: Category[]; products: Product[] }>("/menu"),

  // Place a new order
  createOrder: (data: {
    room_number: string;
    building: string;
    floor: number;
    special_instructions: string;
    items: { product_id: string; quantity: number }[];
  }) =>
    apiRequest<{
      order_id: string;
      order_number: string;
      total_amount: number;
      razorpay_order_id: string;
    }>("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

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

  saveFCMToken: (token: string) =>
    apiRequest<{ message: string }>("/fcm-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
};
