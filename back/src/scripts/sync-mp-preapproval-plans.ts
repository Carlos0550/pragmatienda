import { billingService } from "../billing/application/billing.service";
import { logger } from "../config/logger";

/**
 * Sincroniza los planes de la DB con Mercado Pago:
 * - Crea en MP el preapproval plan para cada plan que tenga precio > 0 y no tenga mpPreapprovalPlanId.
 * - Actualiza en la DB el campo mpPreapprovalPlanId con el id devuelto por MP.
 * No crea nuevos planes en la DB, solo usa los que ya existen.
 *
 * Uso: npm run billing:sync-plans
 */
const run = async () => {
  const result = await billingService.syncAllPreapprovalPlans();
  logger.info("Sync planes → Mercado Pago completado", {
    creados_en_mp: result.created,
    actualizados_en_db: result.updated,
    total_planes: result.total
  });
};

run()
  .catch((error) => {
    const err = error as Error;
    logger.error("Sync planes Mercado Pago falló", {
      message: err.message,
      stack: err.stack
    });
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
