// CampusBites Shared TypeScript Types

export type VerificationStatus = "pending" | "verified" | "rejected";
export type ConfidenceLevel = "high" | "medium" | "low";
export type OrderStatus =
  | "received"
  | "preparing"
  | "packed"
  | "assigned"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type PaymentStatus = "created" | "paid" | "failed" | "refunded";
export type AdminRole = "super_admin" | "staff";

// Hostel Buildings
export const BUILDINGS = [
  "Hostel A",
  "Hostel B",
  "Hostel C",
  "Hostel D",
  "PG Block",
] as const;
export type Building = (typeof BUILDINGS)[number];

// Student Interface
export interface Student {
  id: string;
  mobile_number: string;
  short_name: string;
  roll_number: string;
  last_room_number?: string;
  verification_status: VerificationStatus;
  registered_at: string;
}

// Student Document details (Admin-only context)
export interface StudentDocument {
  id: string;
  student_id: string;
  id_card_url: string;
  ocr_extracted_name?: string;
  ocr_extracted_roll_number?: string;
  name_similarity_score?: number;
  duplicate_flag: boolean;
  confidence_level: ConfidenceLevel;
}

// Product Menu item
export interface Product {
  id: string;
  name: string;
  category_id: string;
  mrp: number;
  selling_price: number;
  image_url: string;
  is_available: boolean;
}

// Category
export interface Category {
  id: string;
  name: string;
}

// Order item line
export interface OrderItem {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
}

// Order header
export interface Order {
  id: string;
  order_number: string;
  student_id: string;
  room_number: string;
  building: string;
  floor: number;
  total_amount: number;
  status: OrderStatus;
  special_instructions?: string;
  created_at: string;
  items?: OrderItem[];
}

// Secure Order View for Delivery Partner
export interface DeliveryOrderView {
  id: string;
  order_number: string;
  student_name: string;
  student_phone: string;
  room_number: string;
  building: string;
  floor: number;
  total_amount: number;
  status: OrderStatus;
  special_instructions?: string;
  items: OrderItem[];
  payment_status: "Paid" | "Unpaid";
  assigned_at: string;
  delivered_at?: string;
  not_available_flag: boolean;
  delivery_notes?: string;
}

// Payment details
export interface Payment {
  id: string;
  order_id: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  amount: number;
  status: PaymentStatus;
}

// Delivery Partner Account
export interface DeliveryPartner {
  id: string;
  name: string;
  mobile_number: string;
  is_online: boolean;
  current_building?: string;
  current_floor?: number;
}

// Audit log entry
export interface AuditLog {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

// API Responses
export interface AuthResponse {
  token: string;
  student?: Student;
  admin?: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
  };
  delivery_partner?: {
    id: string;
    name: string;
    mobile_number: string;
    is_online: boolean;
  };
}

export interface DashboardSummary {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  verified_students: number;
  online_partners: number;
  popular_product: string;
}
