-- CampusBites Database Schema (PostgreSQL)

-- Drop types if they exist
DROP TYPE IF EXISTS verification_status CASCADE;
DROP TYPE IF EXISTS confidence_level CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS admin_role CASCADE;

-- Create Types
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE confidence_level AS ENUM ('high', 'medium', 'low');
CREATE TYPE order_status AS ENUM ('received', 'preparing', 'packed', 'assigned', 'out_for_delivery', 'delivered', 'cancelled');
CREATE TYPE payment_status AS ENUM ('created', 'paid', 'failed', 'refunded');
CREATE TYPE admin_role AS ENUM ('super_admin', 'staff');

-- 1. Students Table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    short_name VARCHAR(100) NOT NULL,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    last_room_number VARCHAR(20),
    fcm_token TEXT,
    verification_status verification_status DEFAULT 'pending',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on mobile number for rapid lookup on logins
CREATE INDEX idx_students_mobile ON students(mobile_number);

-- 2. Student Documents Table (Admin-only access)
CREATE TABLE IF NOT EXISTS student_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    id_card_url TEXT NOT NULL,
    ocr_extracted_name VARCHAR(150),
    ocr_extracted_roll_number VARCHAR(50),
    name_similarity_score DECIMAL(5,2),
    duplicate_flag BOOLEAN DEFAULT FALSE,
    confidence_level confidence_level DEFAULT 'low'
);

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL
);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    mrp DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    image_url TEXT NOT NULL,
    is_available BOOLEAN DEFAULT TRUE
);

-- 5. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    room_number VARCHAR(20) NOT NULL,
    building VARCHAR(50) NOT NULL,
    floor INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status order_status DEFAULT 'received',
    special_instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_student ON orders(student_id);
CREATE INDEX idx_orders_status ON orders(status);

-- 6. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL
);

-- 7. Payments Table (Admin-only access for raw IDs, labels to delivery)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    razorpay_order_id VARCHAR(100) NOT NULL,
    razorpay_payment_id VARCHAR(100),
    razorpay_signature TEXT,
    amount DECIMAL(10,2) NOT NULL,
    status payment_status DEFAULT 'created',
    webhook_log JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_order ON payments(order_id);

-- 8. Delivery Partners Table
CREATE TABLE IF NOT EXISTS delivery_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_online BOOLEAN DEFAULT FALSE,
    current_building VARCHAR(50),
    current_floor INT
);

-- 9. Delivery Assignments Table
CREATE TABLE IF NOT EXISTS delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    delivery_partner_id UUID NOT NULL REFERENCES delivery_partners(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE,
    not_available_flag BOOLEAN DEFAULT FALSE,
    delivery_notes TEXT
);

CREATE INDEX idx_delivery_assignments_partner ON delivery_assignments(delivery_partner_id);

-- 10. Order Status History Table
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    changed_by UUID NOT NULL, -- References admin_users.id or delivery_partners.id or students.id
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role admin_role DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Audit Logs Table (Admin-only access)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL,
    actor_role VARCHAR(30) NOT NULL,
    action VARCHAR(150) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
