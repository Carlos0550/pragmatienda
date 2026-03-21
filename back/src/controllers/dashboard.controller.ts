import { Request, Response } from "express";
import { logger } from "../config/logger";
import { dashboardService } from "../services/Dashboard/dashboard.service";

class DashboardController {
  async getStats(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      // Periodo puede ser 7, 30 o un mes específico en formato YYYY-MM
      const periodParam = req.query.period as string;
      const monthParam = req.query.month as string; // formato: YYYY-MM
      
      let period = 7;
      let year: number | undefined;
      let month: number | undefined;
      
      if (monthParam) {
        // Formato YYYY-MM
        const parts = monthParam.split('-');
        if (parts.length === 2) {
          year = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1; // 0-based month
        }
      } else if (periodParam) {
        period = parseInt(periodParam);
        if (![7, 30].includes(period)) {
          return res.status(400).json({ message: "Periodo inválido. Use 7, 30, o month=YYYY-MM." });
        }
      }

      const result = await dashboardService.getStats(tenantId, period, year, month);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en dashboard getStats controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const dashboardController = new DashboardController();
