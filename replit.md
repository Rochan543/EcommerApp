# ShopEase - E-Commerce Mobile App

## Overview
Full-stack eCommerce system with Expo/React Native mobile app, Express backend, and PostgreSQL database. Features user authentication with role-based access (admin/customer), product catalog with categories, shopping cart, order management, and promotional banners.

## Recent Changes
- 2026-02-09: Initial build of complete eCommerce system
  - PostgreSQL database schema (users, products, categories, orders, cart_items, banners)
  - Express API with JWT auth, bcrypt, role-based middleware
  - Customer mobile app (home, categories, cart, orders, profile tabs)
  - Admin mobile app (dashboard, products, categories, orders, users, banners)
  - Custom earth-tone theme with Inter font family

## User Preferences
- Uses PostgreSQL (Replit built-in) instead of MongoDB
- Admin panel integrated into mobile app via role-based routing
- Earth-tone color scheme: green primary (#1B4332), cream background (#FEFAE0)

## Project Architecture

### Frontend (Expo/React Native)
- **app/_layout.tsx** - Root layout with providers (QueryClient, Auth, etc.)
- **app/index.tsx** - Auth redirect logic
- **app/login.tsx, register.tsx** - Authentication screens
- **app/(customer)/**: Home, Categories, Cart, Orders, Profile tabs
- **app/(admin)/**: Dashboard, Products, Categories, Orders, More tabs
- **app/product/[id].tsx** - Product detail
- **app/category/[id].tsx** - Category products
- **app/checkout.tsx** - Checkout flow
- **lib/auth-context.tsx** - Auth state management with AsyncStorage
- **lib/api.ts** - API helper utilities
- **lib/query-client.ts** - React Query client setup
- **constants/colors.ts** - Theme colors

### Backend (Express + TypeScript)
- **server/routes.ts** - All API route definitions
- **server/middleware.ts** - JWT auth and admin middleware
- **server/storage.ts** - Database operations (Drizzle ORM)
- **server/db.ts** - Database connection
- **shared/schema.ts** - Drizzle schema definitions and Zod validators

### Database (PostgreSQL)
- users (id, name, email, phone, password, role)
- categories (id, name, image, is_active)
- products (id, title, description, price, discount_price, stock, category_id, images, is_active)
- orders (id, user_id, items, total_amount, status, payment_method, payment_status)
- cart_items (id, user_id, product_id, quantity)
- banners (id, title, image, link, is_active)

### Key Design Decisions
- Admin role check: user.role === "admin"
- ID columns use varchar with gen_random_uuid()
- Images stored as JSONB array on products
- Order items stored as JSONB array on orders
- Cart cleared automatically on order placement
