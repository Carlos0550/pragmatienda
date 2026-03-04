import type { NextFunction, Request, Response } from "express";
import { checkoutOriginSchema } from "../services/Cart/cart.zod";

/**
 * Valida el origen del checkout y exige comprobante solo cuando el origen es "cart".
 * Para venta física (origin "sale") el comprobante es opcional.
 * Debe ejecutarse después del middleware de upload para tener req.body y req.file.
 */
export function requireComprobante(req: Request, res: Response, next: NextFunction): void {
  const origin = req.body?.origin;

  const parsed = checkoutOriginSchema.safeParse(origin);
  if (!parsed.success) {
    res.status(400).json({ message: "Origen de checkout inválido." });
    return;
  }

  if (parsed.data === "cart" && !req.file) {
    res.status(400).json({ message: "Comprobante de pago requerido." });
    return;
  }

  next();
}
