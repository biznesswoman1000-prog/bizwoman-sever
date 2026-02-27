import { Response, NextFunction } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middlewares/auth.middleware";

// GET /api/v1/analytics/dashboard
export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const isAdmin = req.user?.role === "ADMIN";
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));

    const [
      totalOrders,
      todayOrders,
      monthStats,
      lastMonthStats,
      totalCustomers,
      newCustomersThisMonth,
      totalProducts,
      lowStockCount,
      outOfStockCount,
      pendingOrders,
      pendingQuotations,
      pendingConsultations,
    ] = await Promise.all([
      prisma.order.count({ where: { paymentStatus: "PAID" } }),
      prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: startOfMonth }, paymentStatus: "PAID" },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          paymentStatus: "PAID",
        },
        _sum: { total: true },
        _count: true,
      }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.user.count({
        where: { role: "CUSTOMER", createdAt: { gte: startOfMonth } },
      }),
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.product.count({
        where: { stockQuantity: { gt: 0, lte: 10 }, status: "ACTIVE" },
      }),
      prisma.product.count({ where: { stockQuantity: 0, status: "ACTIVE" } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.quotation.count({ where: { status: "PENDING" } }),
      prisma.consultation.count({ where: { status: "PENDING" } }),
    ]);

    const monthRevenue = monthStats._sum.total || 0;
    const lastMonthRevenue = lastMonthStats._sum.total || 0;
    const revenueGrowth = lastMonthRevenue
      ? (((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(
          1,
        )
      : "0";

    const base = {
      orders: {
        total: totalOrders,
        today: todayOrders,
        thisMonth: monthStats._count,
        pending: pendingOrders,
      },
      customers: { total: totalCustomers, newThisMonth: newCustomersThisMonth },
      inventory: {
        total: totalProducts,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
      },
      pending: {
        quotations: pendingQuotations,
        consultations: pendingConsultations,
      },
    };

    const financial = isAdmin
      ? {
          revenue: {
            thisMonth: monthRevenue,
            lastMonth: lastMonthRevenue,
            growth: Number(revenueGrowth),
            total:
              (
                await prisma.order.aggregate({
                  where: { paymentStatus: "PAID" },
                  _sum: { total: true },
                })
              )._sum.total || 0,
          },
        }
      : {};

    res.status(200).json({ success: true, data: { ...base, ...financial } });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/analytics/revenue?period=30
export const getRevenueChart = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { period = "30" } = req.query;
    const days = Math.min(Number(period), 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: startDate }, paymentStatus: "PAID" },
      select: { total: true, createdAt: true },
    });

    // Build day-by-day map
    const map: Record<
      string,
      { date: string; revenue: number; orders: number }
    > = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      map[key] = { date: key, revenue: 0, orders: 0 };
    }

    orders.forEach(({ total, createdAt }) => {
      const key = createdAt.toISOString().split("T")[0];
      if (map[key]) {
        map[key].revenue += total;
        map[key].orders += 1;
      }
    });

    res
      .status(200)
      .json({ success: true, data: { chart: Object.values(map) } });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/analytics/top-products?limit=10
export const getTopProducts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { limit = "10" } = req.query;

    const products = await prisma.product.findMany({
      orderBy: { salesCount: "desc" },
      take: Number(limit),
      select: {
        id: true,
        name: true,
        sku: true,
        images: true,
        price: true,
        salesCount: true,
        stockQuantity: true,
        category: { select: { name: true } },
      },
    });

    res.status(200).json({ success: true, data: { products } });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/analytics/inventory
export const getInventoryReport = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [lowStockData, outOfStockData, totalValue] = await Promise.all([
      prisma.product.findMany({
        where: { stockQuantity: { gt: 0, lte: 10 }, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          sku: true,
          images: true,
          stockQuantity: true,
          lowStockThreshold: true,
          price: true,
          category: { select: { name: true } },
        },
        orderBy: { stockQuantity: "asc" },
      }),
      prisma.product.findMany({
        where: { stockQuantity: 0 },
        select: {
          id: true,
          name: true,
          sku: true,
          images: true,
          stockQuantity: true,
          lowStockThreshold: true,
          price: true,
          category: { select: { name: true } },
        },
      }),
      prisma.product.aggregate({
        where: { status: "ACTIVE" },
        _sum: { stockQuantity: true },
      }),
    ]);

    // Calculate stockStatus for each product
    const calculateStockStatus = (product: any) => {
      if (product.stockQuantity === 0) return "OUT_OF_STOCK";
      if (product.stockQuantity <= product.lowStockThreshold)
        return "LOW_STOCK";
      return "IN_STOCK";
    };

    const lowStock = lowStockData.map((product) => ({
      ...product,
      stockStatus: calculateStockStatus(product),
    }));

    const outOfStock = outOfStockData.map((product) => ({
      ...product,
      stockStatus: calculateStockStatus(product),
    }));

    res.status(200).json({
      success: true,
      data: {
        lowStock,
        outOfStock,
        totalStockUnits: totalValue._sum.stockQuantity || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/analytics/customers
export const getCustomerStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [bySegment, topCustomers, recentCustomers] = await Promise.all([
      prisma.user.groupBy({
        by: ["customerSegment"],
        _count: true,
        where: { role: "CUSTOMER" },
      }),
      prisma.user.findMany({
        where: { role: "CUSTOMER", totalSpent: { gt: 0 } },
        orderBy: { totalSpent: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          totalSpent: true,
          orderCount: true,
          lastOrderDate: true,
        },
      }),
      prisma.user.findMany({
        where: { role: "CUSTOMER" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          orderCount: true,
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: { bySegment, topCustomers, recentCustomers },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/analytics/orders-by-status
export const getOrdersByStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const statusBreakdown = await prisma.order.groupBy({
      by: ["status"],
      _count: true,
      _sum: { total: true },
    });

    res.status(200).json({ success: true, data: { statusBreakdown } });
  } catch (error) {
    next(error);
  }
};
