import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  categories,
  products,
  orders,
  cartItems,
  banners,
  type User,
  type InsertUser,
  type Category,
  type Product,
  type Order,
  type CartItem,
  type Banner,
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
  }): Promise<Order> {
    const [order] = await db
      .insert(orders)
      .values({
        userId: data.userId,
        items: data.items,
        totalAmount: data.totalAmount,
        paymentMethod: data.paymentMethod || "cod",
      })
      .returning();
    return order;
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

  async getDashboardStats(): Promise<{
    totalUsers: number;
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
  }> {
    const allUsers = await db.select().from(users);
    const allProducts = await db.select().from(products);
    const allOrders = await db.select().from(orders);
    const totalRevenue = allOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    return {
      totalUsers: allUsers.length,
      totalProducts: allProducts.length,
      totalOrders: allOrders.length,
      totalRevenue,
    };
  }
}

export const storage = new Storage();
