import { Prisma, ProductsStatus } from "@prisma/client";
import { logger } from "../../config/logger";
import { prisma } from "../../db/prisma";
import { dayjs } from "../../config/dayjs";

const decimalToNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof (value as { toString: () => string }).toString === "function"
  ) {
    return Number((value as { toString: () => string }).toString());
  }
  return Number(value ?? 0);
};

interface KpiData {
  revenue: number;
  revenuePrev: number;
  orders: number;
  ordersPrev: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface RevenueChartPoint {
  date: string;
  total: number;
}

interface StockAlert {
  id: string;
  name: string;
  stock: number;
  status: "out_of_stock" | "critical" | "low";
}

interface RecentOrder {
  id: string;
  number: string;
  customerName: string;
  status: string;
  fulfillmentStatus: string;
  total: number;
}

interface TopProduct {
  id: string;
  name: string;
  totalSold: number;
}

interface DashboardStats {
  kpis: KpiData;
  revenueChart: RevenueChartPoint[];
  stockAlerts: StockAlert[];
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
}

type ServiceResponse = { status: number; message: string; data?: DashboardStats; err?: string };

export class DashboardService {
  async getStats(
    tenantId: string,
    period: number,
    year?: number,
    month?: number
  ): Promise<ServiceResponse> {
    try {
      let startDate: Date;
      let endDate: Date;
      let prevStartDate: Date;
      let prevEndDate: Date;
      let chartDays: number;

      if (year !== undefined && month !== undefined) {
        // Modo mes completo
        startDate = dayjs().year(year).month(month).date(1).startOf("day").toDate();
        endDate = dayjs().year(year).month(month + 1).date(0).endOf("day").toDate();
        
        // Período anterior: mes anterior
        prevStartDate = dayjs().year(year).month(month - 1).date(1).startOf("day").toDate();
        prevEndDate = dayjs().year(year).month(month).date(0).endOf("day").toDate();
        
        chartDays = endDate.getUTCDate(); // Días en el mes
      } else {
        // Modo días (7 o 30)
        endDate = dayjs().endOf("day").toDate();
        
        startDate = dayjs(endDate).subtract(period - 1, "day").startOf("day").toDate();
        
        prevEndDate = dayjs(startDate).subtract(1, "day").endOf("day").toDate();
        
        prevStartDate = dayjs(prevEndDate).subtract(period - 1, "day").startOf("day").toDate();
        
        chartDays = period;
      }

      const [kpis, revenueChart, stockAlerts, recentOrders, topProducts] = await Promise.all([
        this.getKpis(tenantId, startDate, endDate, prevStartDate, prevEndDate),
        this.getRevenueChart(tenantId, startDate, endDate, chartDays),
        this.getStockAlerts(tenantId),
        this.getRecentOrders(tenantId),
        this.getTopProducts(tenantId, startDate, endDate)
      ]);

      return {
        status: 200,
        message: "Dashboard stats obtenidos.",
        data: {
          kpis,
          revenueChart,
          stockAlerts,
          recentOrders,
          topProducts
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en dashboard getStats:", err.message);
      return { status: 500, message: "Error al obtener stats del dashboard.", err: err.message };
    }
  }

  private async getKpis(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    prevStartDate: Date,
    prevEndDate: Date
  ): Promise<KpiData> {
    const [currentSales, prevSales, currentOrders, prevOrders, productStockStats] = await Promise.all([
      this.getSalesTotal(tenantId, startDate, endDate),
      this.getSalesTotal(tenantId, prevStartDate, prevEndDate),
      this.getOrdersCount(tenantId, startDate, endDate),
      this.getOrdersCount(tenantId, prevStartDate, prevEndDate),
      this.getProductStockStats(tenantId)
    ]);

    return {
      revenue: currentSales,
      revenuePrev: prevSales,
      orders: currentOrders,
      ordersPrev: prevOrders,
      lowStockCount: productStockStats.lowStock,
      outOfStockCount: productStockStats.outOfStock
    };
  }

  private async getSalesTotal(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
    const sales = await prisma.sales.findMany({
      where: {
        tenantId,
        saleDate: { gte: startDate, lte: endDate }
      },
      select: { total: true }
    });

    return sales.reduce((sum, s) => sum + decimalToNumber(s.total), 0);
  }

  private async getOrdersCount(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
    return prisma.order.count({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate }
      }
    });
  }

  private async getProductStockStats(tenantId: string): Promise<{ lowStock: number; outOfStock: number }> {
    const [outOfStock, lowStock] = await Promise.all([
      prisma.products.count({
        where: {
          tenantId,
          stock: 0,
          status: { not: ProductsStatus.DELETED }
        }
      }),
      prisma.products.count({
        where: {
          tenantId,
          stock: { gt: 0, lte: 5 },
          status: { not: ProductsStatus.DELETED }
        }
      })
    ]);

    return { lowStock, outOfStock };
  }

  private async getRevenueChart(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    period: number
  ): Promise<RevenueChartPoint[]> {
    const sales = await prisma.sales.findMany({
      where: {
        tenantId,
        saleDate: { gte: startDate, lte: endDate }
      },
      select: { saleDate: true, total: true },
      orderBy: { saleDate: "asc" }
    });

    const grouped = new Map<string, number>();
    
    for (const s of sales) {
      const d = dayjs(s.saleDate);
      const key = d.format("YYYY-MM-DD");
      const prev = grouped.get(key) ?? 0;
      grouped.set(key, prev + decimalToNumber(s.total));
    }

    const result: RevenueChartPoint[] = [];
    let current = dayjs(startDate);
    
    while (!current.isAfter(dayjs(endDate))) {
      const dateKey = current.format("YYYY-MM-DD");
      result.push({
        date: dateKey,
        total: grouped.get(dateKey) ?? 0
      });
      current = current.add(1, "day");
    }

    return result;
  }

  private async getStockAlerts(tenantId: string): Promise<StockAlert[]> {
    const products = await prisma.products.findMany({
      where: {
        tenantId,
        stock: { lte: 5 },
        status: { not: ProductsStatus.DELETED }
      },
      select: { id: true, name: true, stock: true },
      orderBy: { stock: "asc" },
      take: 10
    });

    return products.map(p => {
      let status: StockAlert["status"];
      if (p.stock === 0) status = "out_of_stock";
      else if (p.stock <= 1) status = "critical";
      else status = "low";
      
      return {
        id: p.id,
        name: p.name,
        stock: p.stock,
        status
      };
    });
  }

  private async getRecentOrders(tenantId: string): Promise<RecentOrder[]> {
    const orders = await prisma.order.findMany({
      where: { tenantId },
      select: {
        id: true,
        user: { select: { name: true, email: true } },
        guestName: true,
        guestEmail: true,
        status: true,
        fulfillmentStatus: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true
          }
        },
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 4
    });

    return orders.map((o, index) => {
      const total = o.items.reduce((sum, item) => sum + decimalToNumber(item.unitPrice) * item.quantity, 0);
      // Generar número de orden basado en hash simple del ID + offset
      const hash = o.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const orderNumber = 1000 + (hash % 9000);
      const customerName = o.user?.name || o.guestName || o.user?.email?.split("@")[0] || o.guestEmail?.split("@")[0] || "Cliente";
      
      return {
        id: o.id,
        number: `#${orderNumber}`,
        customerName,
        status: o.status,
        fulfillmentStatus: o.fulfillmentStatus,
        total
      };
    });
  }

  private async getTopProducts(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TopProduct[]> {
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate }
        }
      },
      select: {
        productId: true,
        product: { select: { id: true, name: true } },
        quantity: true
      }
    });

    const productSales = new Map<string, { name: string; totalSold: number }>();
    
    for (const item of orderItems) {
      const existing = productSales.get(item.productId);
      if (existing) {
        existing.totalSold += item.quantity;
      } else {
        productSales.set(item.productId, {
          name: item.product.name,
          totalSold: item.quantity
        });
      }
    }

    return Array.from(productSales.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        totalSold: data.totalSold
      }))
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5);
  }
}

export const dashboardService = new DashboardService();
