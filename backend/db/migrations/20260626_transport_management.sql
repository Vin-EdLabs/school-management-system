-- Migration: Transport Management Module
-- Target: vehicles, routes, stops, student_transport, driver_profiles

-- Enable uuid-ossp just in case (though gen_random_uuid is usually built-in)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop and recreate the user role check constraint to include 'driver'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super-admin', 'administrator', 'finance', 'teacher', 'staff', 'driver'));

-- 1. vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plate_number VARCHAR(100) NOT NULL,
  vehicle_name VARCHAR(255) NOT NULL,
  capacity INT NOT NULL,
  model VARCHAR(255),
  color VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_tenant_plate UNIQUE (tenant_id, plate_number)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id);

-- 2. routes table
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  time_of_day VARCHAR(50) NOT NULL DEFAULT 'both' CHECK (time_of_day IN ('morning', 'afternoon', 'both')),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  color VARCHAR(50) NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_routes_tenant ON routes(tenant_id);

-- 3. stops table
CREATE TABLE IF NOT EXISTS stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  order_index INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stops_route ON stops(route_id);

-- 4. student_transport table
CREATE TABLE IF NOT EXISTS student_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  CONSTRAINT unique_student_route UNIQUE (student_id, route_id)
);

CREATE INDEX IF NOT EXISTS idx_student_transport_student ON student_transport(student_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_route ON student_transport(route_id);

-- 5. driver_profiles table
CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(100) NOT NULL,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
