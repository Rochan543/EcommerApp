import type { Express } from "express";
import { createServer, type Server } from "node:http";
// import fetch from "node-fetch";          // 👈 ADD HERE
const fetch = globalThis.fetch;
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import Razorpay from "razorpay";
import { storage } from "./storage";
import {
  type AuthRequest,
  authMiddleware,
  adminMiddleware,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from "./middleware";
import {
  insertUserSchema,
  loginSchema,
  insertCategorySchema,
  insertProductSchema,
  insertOrderSchema,
  insertBannerSchema,
  insertTicketSchema,
  insertAnnouncementSchema,
  insertReviewSchema,
} from "../shared/schema";

function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/uploads", (req, res, next) => {
    const filePath = path.join(uploadDir, req.path);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    next();
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const user = await storage.createUser(parsed.data);
      const tokenPayload = { id: user.id, role: user.role, email: user.email };
      const token = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);
      setAuthCookies(res, token, refreshToken);
      return res.status(201).json({
        token,
        refreshToken,
        user: serializeUser(user),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const user = await storage.getUserByEmail(parsed.data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(parsed.data.password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const tokenPayload = { id: user.id, role: user.role, email: user.email };
      const token = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);
      setAuthCookies(res, token, refreshToken);
      return res.json({
        token,
        refreshToken,
        user: serializeUser(user),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Server error" });
    }
  });

  function serializeUser(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      profileImage: user.profileImage || "",
      city: user.city || "",
      state: user.state || "",
      pincode: user.pincode || "",
      country: user.country || "India",
      latitude: user.latitude || null,
      longitude: user.longitude || null,
      addressLine1: user.addressLine1 || "",
      addressLine2: user.addressLine2 || "",
    };
  }

  app.get("/api/auth/me", authMiddleware as any, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json(serializeUser(user));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const refreshTokenValue = req.body.refreshToken || req.cookies?.refresh_token;
      if (!refreshTokenValue) {
        return res.status(401).json({ message: "No refresh token provided" });
      }

      const decoded = verifyRefreshToken(refreshTokenValue);
      if (!decoded) {
        clearAuthCookies(res);
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }

      const user = await storage.getUserById(decoded.id);
      if (!user) {
        clearAuthCookies(res);
        return res.status(401).json({ message: "User not found" });
      }

      const tokenPayload = { id: user.id, role: user.role, email: user.email };
      const newAccessToken = generateToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);
      setAuthCookies(res, newAccessToken, newRefreshToken);

      return res.json({
        token: newAccessToken,
        refreshToken: newRefreshToken,
        user: serializeUser(user),
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearAuthCookies(res);
    return res.json({ message: "Logged out" });
  });

  app.put("/api/auth/profile", authMiddleware as any, async (req: any, res) => {
    try {
      const { name, phone } = req.body;
      const user = await storage.updateUser(req.user.id, { name, phone });
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json(serializeUser(user));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/profile-image", authMiddleware as any, upload.single("image"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const imageUrl = `/uploads/${req.file.filename}`;
      const user = await storage.updateUser(req.user.id, { profileImage: imageUrl });
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json(serializeUser(user));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/auth/location", authMiddleware as any, async (req: any, res) => {
    try {
      const { city, state, pincode, country, latitude, longitude, addressLine1, addressLine2 } = req.body;
      const updateData: any = {};
      if (city !== undefined) updateData.city = city;
      if (state !== undefined) updateData.state = state;
      if (pincode !== undefined) updateData.pincode = pincode;
      if (country !== undefined) updateData.country = country;
      if (latitude !== undefined) updateData.latitude = latitude;
      if (longitude !== undefined) updateData.longitude = longitude;
      if (addressLine1 !== undefined) updateData.addressLine1 = addressLine1;
      if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2;
      const user = await storage.updateUser(req.user.id, updateData);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json(serializeUser(user));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/categories", async (_req, res) => {
    try {
      const cats = await storage.getActiveCategories();
      return res.json(cats);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const cat = await storage.getCategoryById(req.params.id);
      if (!cat) return res.status(404).json({ message: "Category not found" });
      return res.json(cat);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/products", async (_req, res) => {
    try {
      const prods = await storage.getActiveProducts();
      return res.json(prods);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const prod = await storage.getProductById(req.params.id);
      if (!prod) return res.status(404).json({ message: "Product not found" });
      return res.json(prod);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/products/category/:categoryId", async (req, res) => {
    try {
      const prods = await storage.getProductsByCategory(req.params.categoryId);
      return res.json(prods.filter((p) => p.isActive));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/banners", async (_req, res) => {
    try {
      const b = await storage.getActiveBanners();
      return res.json(b);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/cart", authMiddleware as any, async (req: any, res) => {
    try {
      const items = await storage.getCartItems(req.user.id);
      const enriched = await Promise.all(
        items.map(async (item) => {
          const product = await storage.getProductById(item.productId);
          return { ...item, product };
        })
      );
      return res.json(enriched.filter((i) => i.product));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/cart", authMiddleware as any, async (req: any, res) => {
    try {
      const { productId, quantity, size } = req.body;
      if (!productId) return res.status(400).json({ message: "Product ID required" });
      const product = await storage.getProductById(productId);
      if (product && product.sizes && (product.sizes as any[]).length > 0 && !size) {
        return res.status(400).json({ message: "Please select a size" });
      }
      const item = await storage.addToCart(req.user.id, productId, quantity || 1, size);
      return res.status(201).json(item);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/cart/:id", authMiddleware as any, async (req: any, res) => {
    try {
      const { quantity } = req.body;
      const item = await storage.updateCartItem(req.params.id, quantity);
      if (!item) return res.status(404).json({ message: "Cart item not found" });
      return res.json(item);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/cart/:id", authMiddleware as any, async (req: any, res) => {
    try {
      await storage.removeCartItem(req.params.id);
      return res.json({ message: "Item removed" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/products/recommended/:productId", async (req, res) => {
    try {
      const product = await storage.getProductById(req.params.productId);
      if (!product || !product.categoryId) {
        return res.json([]);
      }
      const recommended = await storage.getRecommendedProducts(
        product.categoryId,
        product.id,
        6
      );
      const shaped = recommended.map((p) => ({
        _id: p.id,
        title: p.title,
        price: p.discountPrice ?? p.price,
        image: (p.images && p.images.length > 0) ? p.images[0] : null,
        category: p.categoryId,
      }));
      return res.json(shaped);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const reviewsList = await storage.getReviewsByProduct(req.params.id);
      return res.json(reviewsList);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/products/:id/review", authMiddleware as any, async (req: any, res) => {
    try {
      const parsed = insertReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const existing = await storage.getUserReviewForProduct(req.user.id, req.params.id);
      if (existing) {
        return res.status(400).json({ message: "You have already reviewed this product" });
      }

      const product = await storage.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const reviewUser = await storage.getUserById(req.user.id);
      const userName = reviewUser?.name || "Anonymous";

      const review = await storage.createReview({
        productId: req.params.id,
        userId: req.user.id,
        userName,
        rating: parsed.data.rating,
        comment: parsed.data.comment || "",
      });

      return res.status(201).json(review);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/reviews", authMiddleware as any, adminMiddleware as any, async (_req: any, res) => {
    try {
      const allReviews = await storage.getAllReviews();
      return res.json(allReviews);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/reviews/:id", authMiddleware as any, adminMiddleware as any, async (req: any, res) => {
    try {
      await storage.deleteReview(req.params.id);
      return res.json({ message: "Review deleted" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payment/create-order", authMiddleware as any, async (req: any, res) => {
    try {
      const razorpay = getRazorpayInstance();
      if (!razorpay) {
        return res.status(500).json({ message: "Payment gateway not configured" });
      }

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const options = {
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);
      return res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Payment order creation failed" });
    }
  });

  app.post("/api/payment/verify", authMiddleware as any, async (req: any, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const key_secret = process.env.RAZORPAY_KEY_SECRET;

      if (!key_secret) {
        return res.status(500).json({ message: "Payment gateway not configured" });
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", key_secret)
        .update(body)
        .digest("hex");

      if (expectedSignature === razorpay_signature) {
        return res.json({ verified: true });
      } else {
        return res.status(400).json({ verified: false, message: "Payment verification failed" });
      }
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/orders", authMiddleware as any, async (req: any, res) => {
    try {
      const parsed = insertOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const orderData: any = {
        userId: req.user.id,
        ...parsed.data,
      };

      if (parsed.data.paymentMethod === "cod") {
        orderData.paymentStatus = "pending";
      }

      const order = await storage.createOrder(orderData);

      if (!req.body.skipCartClear) {
        await storage.clearCart(req.user.id);
      }
      return res.status(201).json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/orders", authMiddleware as any, async (req: any, res) => {
    try {
      const userOrders = await storage.getOrdersByUser(req.user.id);
      return res.json(userOrders);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/orders/:id", authMiddleware as any, async (req: any, res) => {
    try {
      const order = await storage.getOrderById(req.params.id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      return res.json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/upload", authMiddleware as any, upload.single("image"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const imageUrl = `/uploads/${req.file.filename}`;
      return res.json({ url: imageUrl });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get(
    "/api/admin/categories",
    authMiddleware as any,
    adminMiddleware as any,
    async (_req: any, res) => {
      try {
        const cats = await storage.getAllCategories();
        return res.json(cats);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/categories",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const parsed = insertCategorySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        }
        const category = await storage.createCategory(parsed.data);
        return res.status(201).json(category);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.put(
    "/api/admin/categories/:id",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const category = await storage.updateCategory(req.params.id, req.body);
        if (!category) return res.status(404).json({ message: "Category not found" });
        return res.json(category);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.delete(
    "/api/admin/categories/:id",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        await storage.deleteCategory(req.params.id);
        return res.json({ message: "Category deleted" });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/products",
    authMiddleware as any,
    adminMiddleware as any,
    async (_req: any, res) => {
      try {
        const prods = await storage.getAllProducts();
        return res.json(prods);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/products",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const parsed = insertProductSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        }
        const product = await storage.createProduct(parsed.data);
        return res.status(201).json(product);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.put(
    "/api/admin/products/:id",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const product = await storage.updateProduct(req.params.id, req.body);
        if (!product) return res.status(404).json({ message: "Product not found" });
        return res.json(product);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.delete(
    "/api/admin/products/:id",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        await storage.deleteProduct(req.params.id);
        return res.json({ message: "Product deleted" });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/orders",
    authMiddleware as any,
    adminMiddleware as any,
    async (_req: any, res) => {
      try {
        const allOrders = await storage.getAllOrders();
        const enriched = await Promise.all(
          allOrders.map(async (o) => {
            const user = await storage.getUserById(o.userId);
            return { ...o, userName: user?.name || "Unknown" };
          })
        );
        return res.json(enriched);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.put(
    "/api/admin/orders/:id/status",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const { status } = req.body;
        const order = await storage.updateOrderStatus(req.params.id, status);
        if (!order) return res.status(404).json({ message: "Order not found" });
        return res.json(order);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/users",
    authMiddleware as any,
    adminMiddleware as any,
    async (_req: any, res) => {
      try {
        const allUsers = await storage.getAllUsers();
        const safe = allUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          phone: u.phone,
          createdAt: u.createdAt,
        }));
        return res.json(safe);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/banners",
    authMiddleware as any,
    adminMiddleware as any,
    async (_req: any, res) => {
      try {
        const b = await storage.getAllBanners();
        return res.json(b);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/banners",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const parsed = insertBannerSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        }
        const banner = await storage.createBanner(parsed.data);
        return res.status(201).json(banner);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.put(
    "/api/admin/banners/:id",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const banner = await storage.updateBanner(req.params.id, req.body);
        if (!banner) return res.status(404).json({ message: "Banner not found" });
        return res.json(banner);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.delete(
    "/api/admin/banners/:id",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        await storage.deleteBanner(req.params.id);
        return res.json({ message: "Banner deleted" });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/dashboard",
    authMiddleware as any,
    adminMiddleware as any,
    async (_req: any, res) => {
      try {
        const stats = await storage.getDashboardStats();
        return res.json(stats);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get(
    "/api/admin/orders-tracker",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const { filter } = req.query;
        let allOrders = await storage.getAllOrders();

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const thirtyDaysAgo = new Date(startOfToday);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (filter === "today") {
          allOrders = allOrders.filter((o) => o.createdAt && new Date(o.createdAt) >= startOfToday);
        } else if (filter === "yesterday") {
          allOrders = allOrders.filter(
            (o) => o.createdAt && new Date(o.createdAt) >= startOfYesterday && new Date(o.createdAt) < startOfToday
          );
        } else if (filter === "last30") {
          allOrders = allOrders.filter((o) => o.createdAt && new Date(o.createdAt) >= thirtyDaysAgo);
        }

        const enriched = await Promise.all(
          allOrders.map(async (o) => {
            const user = await storage.getUserById(o.userId);
            const productNames = (o.items || []).map((i: any) => i.title).join(", ");
            return {
              id: o.id,
              userName: user?.name || "Unknown",
              userPhone: user?.phone || "-",
              productNames,
              paymentType: o.paymentStatus === "paid" ? "Paid" : "COD",
              totalAmount: o.totalAmount,
              deliveryAddress: o.shippingAddress
                ? `${o.shippingAddress.addressLine1}, ${o.shippingAddress.city}, ${o.shippingAddress.state} ${o.shippingAddress.pincode}`
                : "-",
              status: o.status,
              createdAt: o.createdAt,
            };
          })
        );
        return res.json(enriched);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // --- Shipping Profile ---
  app.get("/api/auth/shipping", authMiddleware as any, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({
        fullName: user.fullName || "",
        phone: user.phone || "",
        addressLine1: user.addressLine1 || "",
        addressLine2: user.addressLine2 || "",
        city: user.city || "",
        state: user.state || "",
        pincode: user.pincode || "",
        country: user.country || "India",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/auth/shipping", authMiddleware as any, async (req: any, res) => {
    try {
      const { fullName, phone, addressLine1, addressLine2, city, state, pincode, country } = req.body;
      const user = await storage.updateUser(req.user.id, {
        fullName, phone, addressLine1, addressLine2, city, state, pincode, country,
      });
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({
        fullName: user.fullName || "",
        phone: user.phone || "",
        addressLine1: user.addressLine1 || "",
        addressLine2: user.addressLine2 || "",
        city: user.city || "",
        state: user.state || "",
        pincode: user.pincode || "",
        country: user.country || "India",
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // --- Forgot Password (OTP) ---
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "No account found with this email" });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.setOtp(user.id, otp, expiresAt);

      console.log(`[OTP] Password reset OTP for ${email}: ${otp}`);

      return res.json({ message: "OTP sent to your email", userId: user.id });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!user.otpCode || !user.otpExpiresAt) {
        return res.status(400).json({ message: "No OTP requested" });
      }

      if (new Date() > new Date(user.otpExpiresAt)) {
        await storage.clearOtp(user.id);
        return res.status(400).json({ message: "OTP has expired" });
      }

      if (user.otpCode !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      await storage.clearOtp(user.id);
      return res.json({ message: "OTP verified", verified: true, userId: user.id });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      if (!email || !newPassword) return res.status(400).json({ message: "Email and new password are required" });
      if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "User not found" });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hashedPassword);

      return res.json({ message: "Password reset successfully" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // --- Support Tickets (Customer) ---
  app.get("/api/tickets", authMiddleware as any, async (req: any, res) => {
    try {
      const tickets = await storage.getTicketsByUser(req.user.id);
      return res.json(tickets);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/tickets", authMiddleware as any, async (req: any, res) => {
    try {
      const parsed = insertTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const ticket = await storage.createTicket({
        userId: req.user.id,
        ...parsed.data,
      });
      return res.status(201).json(ticket);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/tickets/:id", authMiddleware as any, async (req: any, res) => {
    try {
      const ticket = await storage.getTicketById(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.userId !== req.user.id) return res.status(403).json({ message: "Not authorized" });
      if (ticket.status !== "open") return res.status(400).json({ message: "Only open tickets can be edited" });

      const { subject, message, category } = req.body;
      const updated = await storage.updateTicket(req.params.id, {
        ...(subject && { subject }),
        ...(message && { message }),
        ...(category && { category }),
      });
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // --- AI Chatbot ---
  app.post("/api/chatbot", authMiddleware as any, async (req: any, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ message: "Message is required" });

      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return res.json({
          reply: "I can help you with orders, products, returns, and shipping. For detailed support, please create a support ticket from the help section.",
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a helpful customer support chatbot for MrPerfectFashionClub, an e-commerce platform. Keep responses concise (2-3 sentences max). Help with: order tracking, returns, shipping, product questions, account issues. If the issue requires human support, suggest creating a support ticket. User message: ${message}`,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        return res.json({
          reply: "I can help you with orders, products, returns, and shipping. For detailed support, please create a support ticket.",
        });
      }

      const data = (await response.json()) as any;
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm here to help! Please create a support ticket for detailed assistance.";
      return res.json({ reply });
    } catch (err: any) {
      return res.json({
        reply: "I can help you with orders, products, returns, and shipping. For detailed support, please create a support ticket.",
      });
    }
  });

  // --- Admin Tickets ---
  app.get(
    "/api/admin/tickets",
    authMiddleware as any,
    adminMiddleware as any,
    async (_req: any, res) => {
      try {
        const tickets = await storage.getAllTickets();
        const enriched = await Promise.all(
          tickets.map(async (t) => {
            const user = await storage.getUserById(t.userId);
            return { ...t, userName: user?.name || "Unknown", userEmail: user?.email || "" };
          })
        );
        return res.json(enriched);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.put(
    "/api/admin/tickets/:id",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const { status, adminReply } = req.body;
        const ticket = await storage.updateTicket(req.params.id, { status, adminReply });
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });
        return res.json(ticket);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // --- Order Tracking (Admin update) ---
  app.put(
    "/api/admin/orders/:id/tracking",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const { trackingSteps } = req.body;
        if (!trackingSteps) return res.status(400).json({ message: "Tracking steps required" });

        const order = await storage.updateOrderTracking(req.params.id, trackingSteps);
        if (!order) return res.status(404).json({ message: "Order not found" });

        const lastCompleted = [...trackingSteps].reverse().find((s: any) => s.completed);
        let newStatus = "pending";
        if (lastCompleted) {
          const stepMap: Record<string, string> = {
            "Ordered": "confirmed",
            "Packed": "processing",
            "Shipped": "shipped",
            "Out for Delivery": "shipped",
            "Delivered": "delivered",
          };
          newStatus = stepMap[lastCompleted.step] || "pending";
        }
        await storage.updateOrderStatus(req.params.id, newStatus);

        return res.json(order);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // --- Announcements (Admin CRUD) ---
  app.get(
    "/api/admin/announcements",
    authMiddleware as any,
    adminMiddleware as any,
    async (_req: any, res) => {
      try {
        const all = await storage.getAllAnnouncements();
        return res.json(all);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.post(
    "/api/admin/announcements",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const parsed = insertAnnouncementSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        }
        const ann = await storage.createAnnouncement({
          title: parsed.data.title,
          message: parsed.data.message || "",
          image: parsed.data.image || "",
          isActive: parsed.data.isActive ?? true,
          startDate: new Date(parsed.data.startDate),
          endDate: new Date(parsed.data.endDate),
        });
        return res.status(201).json(ann);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.put(
    "/api/admin/announcements/:id",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        const updates: any = { ...req.body };
        if (updates.startDate) updates.startDate = new Date(updates.startDate);
        if (updates.endDate) updates.endDate = new Date(updates.endDate);
        const ann = await storage.updateAnnouncement(req.params.id, updates);
        if (!ann) return res.status(404).json({ message: "Announcement not found" });
        return res.json(ann);
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.delete(
    "/api/admin/announcements/:id",
    authMiddleware as any,
    adminMiddleware as any,
    async (req: any, res) => {
      try {
        await storage.deleteAnnouncement(req.params.id);
        return res.json({ message: "Announcement deleted" });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  // --- Announcements (User-facing) ---
  app.get("/api/announcements/active", authMiddleware as any, async (req: any, res) => {
    try {
      const active = await storage.getActiveAnnouncementsForUser(req.user.id);
      return res.json(active);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/announcements/viewed", authMiddleware as any, async (req: any, res) => {
    try {
      const { announcementId } = req.body;
      if (!announcementId) return res.status(400).json({ message: "announcementId required" });
      await storage.markAnnouncementViewed(req.user.id, announcementId);
      return res.json({ message: "Marked as viewed" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
