# ShopEase - E-Commerce Mobile App

## Overview
Full-stack eCommerce system with Expo/React Native mobile app, Express backend, and PostgreSQL database. Features user authentication with role-based access (admin/customer), product catalog with categories, shopping cart, order management, promotional banners, Buy Now functionality, Razorpay payment gateway, and recommended products. Zero browser storage policy: all auth uses HTTP-only cookies, no localStorage/sessionStorage/AsyncStorage.

## Recent Changes
- 2026-02-09: Production security audit - zero browser storage
  - Eliminated all AsyncStorage, localStorage, sessionStorage usage
  - Auth tokens (access + refresh) stored as HTTP-only secure cookies (sameSite:'none', httpOnly:true, secure:true)
  - Server: cookie-parser middleware, auth endpoints set/clear cookies, CORS credentials:true
  - Auth middleware reads tokens from cookies first, falls back to Authorization header
  - Client: All fetch requests use credentials:'include' for automatic cookie handling
  - Token state in memory only (never persisted client-side), refreshed via cookie-based /api/auth/refresh
  - LocationContext derives permission state from user data (city/pincode) instead of AsyncStorage
  - POST /api/auth/logout endpoint clears cookies server-side
- 2026-02-09: Announcements system and automatic location detection
  - Admin CRUD for announcements (title, message, image, active toggle)
  - User-facing animated popup with sequential viewing and dot indicators
  - View tracking via /api/announcements/:id/view endpoint
  - Automatic location detection: GPS permission flow with expo-location
  - OpenStreetMap Nominatim reverse geocoding (free, no API key)
  - Location fields on users: city, state, pincode, country, latitude, longitude, addressLine1, addressLine2
  - PUT /api/auth/location endpoint for saving location data
  - LocationContext (lib/location-context.tsx) managing permission state and geocoding
  - Home page header shows "Deliver to: City, Pincode" with change modal
  - Manual location entry modal with city/pincode/state/address fields
  - Permission prompt banner with Allow/Deny buttons
- 2026-02-09: Buy Now, Razorpay payments, and recommended products
  - Buy Now button on product detail page (skips cart, goes directly to checkout)
  - Razorpay payment gateway integration (GPay, PhonePe, UPI, debit/credit cards)
  - Backend APIs: /api/payment/create-order, /api/payment/verify (HMAC SHA256 signature validation)
  - Cross-platform payment: WebView on native mobile, Razorpay checkout.js on web
  - Recommended products section on product detail page (up to 6 same-category items)
  - Checkout page with shipping address form and multiple payment method options
  - Database schema extended: razorpayOrderId, razorpayPaymentId, shippingAddress on orders
  - Login/register now properly navigate to home after success
  - Environment variables needed: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
- 2026-02-09: Auth hardening and security improvements
  - JWT access token (15min) + refresh token (30d) flow
  - /api/auth/refresh endpoint for session restoration
  - Auto 401 retry with token refresh in API helpers (lib/api.ts, lib/query-client.ts)
  - Server-side session validation on app load (lib/auth-context.tsx)
  - Separate admin-login screen (app/admin-login.tsx)
  - Admin panel link removed from customer profile
  - Route guards on (admin) and (customer) layouts
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
- **lib/auth-context.tsx** - Auth state management with HTTP-only cookies (zero browser storage)
- **lib/location-context.tsx** - Location detection and management
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
- users (id, name, email, phone, password, role, city, state, pincode, country, latitude, longitude, addressLine1, addressLine2)
- announcements (id, title, message, image, is_active, created_at)
- categories (id, name, image, is_active)
- products (id, title, description, price, discount_price, stock, category_id, images, is_active)
- orders (id, user_id, items, total_amount, status, payment_method, payment_status, razorpay_order_id, razorpay_payment_id, shipping_address)
- cart_items (id, user_id, product_id, quantity)
- banners (id, title, image, link, is_active)

### Key Design Decisions
- Zero browser storage: No localStorage, sessionStorage, AsyncStorage, or IndexedDB
- Auth via HTTP-only cookies (access_token 15min, refresh_token 30d)
- Auth middleware: cookies first, Authorization header fallback (for native mobile)
- All API requests use credentials:'include' for cookie transport
- Admin role check: user.role === "admin"
- ID columns use varchar with gen_random_uuid()
- Images stored as JSONB array on products
- Order items stored as JSONB array on orders
- Cart cleared automatically on order placement
