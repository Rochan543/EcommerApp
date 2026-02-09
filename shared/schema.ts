import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").default(""),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  fullName: text("full_name").default(""),
  addressLine1: text("address_line1").default(""),
  addressLine2: text("address_line2").default(""),
  city: text("city").default(""),
  state: text("state").default(""),
  pincode: text("pincode").default(""),
  country: text("country").default("India"),
  profileImage: text("profile_image").default(""),
  otpCode: text("otp_code"),
  otpExpiresAt: timestamp("otp_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  image: text("image").default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").default(""),
  price: doublePrecision("price").notNull(),
  discountPrice: doublePrecision("discount_price"),
  stock: integer("stock").notNull().default(0),
  categoryId: varchar("category_id").references(() => categories.id),
  images: jsonb("images").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  items: jsonb("items")
    .$type<{ productId: string; quantity: number; price: number; title: string }[]>()
    .notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method").default("cod"),
  paymentStatus: text("payment_status").default("pending"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  shippingAddress: jsonb("shipping_address").$type<{
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  }>(),
  trackingSteps: jsonb("tracking_steps").$type<{
    step: string;
    completed: boolean;
    completedAt?: string;
  }[]>().default([
    { step: "Ordered", completed: true, completedAt: new Date().toISOString() },
    { step: "Packed", completed: false },
    { step: "Shipped", completed: false },
    { step: "Out for Delivery", completed: false },
    { step: "Delivered", completed: false },
  ]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  productId: varchar("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
});

export const banners = pgTable("banners", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  image: text("image").default(""),
  link: text("link").default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  category: text("category").notNull().default("General"),
  orderId: text("order_id"),
  status: text("status").notNull().default("open"),
  adminReply: text("admin_reply"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  email: true,
  phone: true,
  password: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  image: true,
  isActive: true,
});

export const insertProductSchema = createInsertSchema(products).pick({
  title: true,
  description: true,
  price: true,
  discountPrice: true,
  stock: true,
  categoryId: true,
  images: true,
  isActive: true,
});

export const insertOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().min(1),
      price: z.number(),
      title: z.string(),
    })
  ),
  totalAmount: z.number(),
  paymentMethod: z.string().optional(),
  paymentStatus: z.string().optional(),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  shippingAddress: z.object({
    fullName: z.string(),
    phone: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
  }).optional(),
});

export const insertBannerSchema = createInsertSchema(banners).pick({
  title: true,
  image: true,
  link: true,
  isActive: true,
});

export const announcements = pgTable("announcements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull().default(""),
  image: text("image").default(""),
  isActive: boolean("is_active").notNull().default(true),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const announcementViews = pgTable("announcement_views", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  announcementId: varchar("announcement_id")
    .notNull()
    .references(() => announcements.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

export const insertTicketSchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
  category: z.string(),
  orderId: z.string().optional(),
});

export const insertAnnouncementSchema = z.object({
  title: z.string().min(1),
  message: z.string().optional(),
  image: z.string().optional(),
  isActive: z.boolean().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Banner = typeof banners.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type AnnouncementView = typeof announcementViews.$inferSelect;
