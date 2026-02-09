import { eq, desc, and, ne } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  categories,
  products,
  orders,
  cartItems,
  banners,
  supportTickets,
  type User,
  type InsertUser,
  type Category,
  type Product,
  type Order,
  type CartItem,
  type Banner,
  type SupportTicket,
} from "../shared/schema";
import bcrypt from "bcryptjs";

export class Storage {
  async createUser(data: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const [user] = await db
      .insert(users)
      .values({ ...data, password: hashedPassword })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id)).returning();
    return user;
  }

  async setOtp(userId: string, otpCode: string, expiresAt: Date): Promise<void> {
    await db.update(users).set({ otpCode, otpExpiresAt: expiresAt }).where(eq(users.id, userId));
  }

  async clearOtp(userId: string): Promise<void> {
    await db.update(users).set({ otpCode: null, otpExpiresAt: null }).where(eq(users.id, userId));
  }

  async createCategory(data: Partial<Category>): Promise<Category> {
    const [category] = await db.insert(categories).values(data as any).returning();
    return category;
  }

  async getAllCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(desc(categories.createdAt));
  }

  async getActiveCategories(): Promise<Category[]> {
    return db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(desc(categories.createdAt));
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async createProduct(data: Partial<Product>): Promise<Product> {
    const [product] = await db.insert(products).values(data as any).returning();
    return product;
  }

  async getAllProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getActiveProducts(): Promise<Product[]> {
    return db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(products.createdAt));
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return db
      .select()
      .from(products)
      .where(eq(products.categoryId, categoryId))
      .orderBy(desc(products.createdAt));
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product | undefined> {
    const [product] = await db
      .update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getCartItems(userId: string): Promise<CartItem[]> {
    return db.select().from(cartItems).where(eq(cartItems.userId, userId));
  }

  async addToCart(userId: string, productId: string, quantity: number): Promise<CartItem> {
    const existing = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .then((items) => items.find((i) => i.productId === productId));

    if (existing) {
      const [updated] = await db
        .update(cartItems)
        .set({ quantity: existing.quantity + quantity })
        .where(eq(cartItems.id, existing.id))
        .returning();
      return updated;
    }

    const [item] = await db
      .insert(cartItems)
      .values({ userId, productId, quantity })
      .returning();
    return item;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const [item] = await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, id))
      .returning();
    return item;
  }

  async removeCartItem(id: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  async createOrder(data: {
    userId: string;
    items: { productId: string; quantity: number; price: number; title: string }[];
    totalAmount: number;
    paymentMethod?: string;
    paymentStatus?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    shippingAddress?: any;
  }): Promise<Order> {
    const now = new Date().toISOString();
    const [order] = await db
      .insert(orders)
      .values({
        userId: data.userId,
        items: data.items,
        totalAmount: data.totalAmount,
        paymentMethod: data.paymentMethod || "cod",
        paymentStatus: data.paymentStatus || "pending",
        razorpayOrderId: data.razorpayOrderId,
        razorpayPaymentId: data.razorpayPaymentId,
        shippingAddress: data.shippingAddress,
        trackingSteps: [
          { step: "Ordered", completed: true, completedAt: now },
          { step: "Packed", completed: false },
          { step: "Shipped", completed: false },
          { step: "Out for Delivery", completed: false },
          { step: "Delivered", completed: false },
        ],
      })
      .returning();
    return order;
  }

  async updateOrderPayment(
    id: string,
    data: { paymentStatus: string; razorpayPaymentId?: string }
  ): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set(data)
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async getRecommendedProducts(
    categoryId: string,
    excludeProductId: string,
    limit: number = 6
  ): Promise<Product[]> {
    const prods = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.categoryId, categoryId),
          eq(products.isActive, true),
          ne(products.id, excludeProductId)
        )
      )
      .limit(limit);
    return prods;
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async getAllOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async updateOrderTracking(id: string, trackingSteps: any[]): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ trackingSteps })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async createBanner(data: Partial<Banner>): Promise<Banner> {
    const [banner] = await db.insert(banners).values(data as any).returning();
    return banner;
  }

  async getAllBanners(): Promise<Banner[]> {
    return db.select().from(banners).orderBy(desc(banners.createdAt));
  }

  async getActiveBanners(): Promise<Banner[]> {
    return db
      .select()
      .from(banners)
      .where(eq(banners.isActive, true))
      .orderBy(desc(banners.createdAt));
  }

  async updateBanner(id: string, data: Partial<Banner>): Promise<Banner | undefined> {
    const [banner] = await db
      .update(banners)
      .set(data)
      .where(eq(banners.id, id))
      .returning();
    return banner;
  }

  async deleteBanner(id: string): Promise<void> {
    await db.delete(banners).where(eq(banners.id, id));
  }

  async createTicket(data: {
    userId: string;
    subject: string;
    message: string;
    category: string;
    orderId?: string;
  }): Promise<SupportTicket> {
    const [ticket] = await db
      .insert(supportTickets)
      .values(data)
      .returning();
    return ticket;
  }

  async getTicketsByUser(userId: string): Promise<SupportTicket[]> {
    return db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async getAllTickets(): Promise<SupportTicket[]> {
    return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  }

  async getTicketById(id: string): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket;
  }

  async updateTicket(id: string, data: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const [ticket] = await db
      .update(supportTickets)
      .set(data)
      .where(eq(supportTickets.id, id))
      .returning();
    return ticket;
  }

  async getDashboardStats(): Promise<{
    totalUsers: number;
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    totalTickets: number;
  }> {
    const allUsers = await db.select().from(users);
    const allProducts = await db.select().from(products);
    const allOrders = await db.select().from(orders);
    const allTickets = await db.select().from(supportTickets);
    const totalRevenue = allOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    return {
      totalUsers: allUsers.length,
      totalProducts: allProducts.length,
      totalOrders: allOrders.length,
      totalRevenue,
      totalTickets: allTickets.length,
    };
  }
}

export const storage = new Storage();
