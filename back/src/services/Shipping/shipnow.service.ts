import { logger } from "../../config/logger";
import { env } from "../../config/env";
import type { PackageSummary } from "../Shipping/shipping.service";

interface ShipnowAddress {
  name: string;
  street: string;
  number: string;
  city: string;
  province: string;
  postal_code: string;
  phone: string;
  email?: string;
  floor?: string;
  apartment?: string;
  references?: string;
}

interface ShipnowPackage {
  weight: number;
  height: number;
  width: number;
  length: number;
}

interface ShipnowQuoteRequest {
  origin: ShipnowAddress;
  destination: ShipnowAddress;
  packages: ShipnowPackage[];
}

interface ShipnowRate {
  id: string;
  carrier: string;
  service: string;
  service_code: string;
  price: number;
  currency: string;
  estimated_delivery: string;
  tracking_available: boolean;
}

interface ShipnowQuoteResponse {
  rates: ShipnowRate[];
}

interface ShipnowShipmentRequest {
  rate_id: string;
  origin: ShipnowAddress;
  destination: ShipnowAddress;
  packages: ShipnowPackage[];
  order_id: string;
  reference?: string;
}

interface ShipnowShipment {
  id: string;
  tracking_code: string;
  label_url: string;
  status: string;
  carrier: string;
  service: string;
}

interface ShipnowShipmentResponse {
  shipment: ShipnowShipment;
}

interface ShipnowStatusResponse {
  id: string;
  status: string;
  tracking_code: string;
  carrier: string;
  events: Array<{
    date: string;
    status: string;
    description: string;
    location?: string;
  }>;
}

const SHIPNOW_API_URL = env.NODE_ENV === "production"
  ? "https://api.shipnow.com.ar/v1"
  : "https://api.shipnow.com.ar/v1"; // Sandbox URL, ajustar según documentación real

const SHIPNOW_API_TOKEN = env.SHIPNOW_API_TOKEN || "";

class ShipnowService {
  private apiToken: string;
  private baseUrl: string;

  constructor() {
    this.apiToken = SHIPNOW_API_TOKEN;
    this.baseUrl = SHIPNOW_API_URL;

    if (!this.apiToken) {
      logger.warn("SHIPNOW_API_TOKEN no está configurado. Las funciones de ShipNow no estarán disponibles.");
    }
  }

  private async fetch(endpoint: string, options: RequestInit = {}): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.apiToken) {
      headers["Authorization"] = `Bearer ${this.apiToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ShipNow API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("Error en ShipNow API", { endpoint, error: (error as Error).message });
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.apiToken;
  }

  async getRates(
    origin: ShipnowAddress,
    destination: ShipnowAddress,
    packageSummary: PackageSummary
  ): Promise<ShipnowRate[]> {
    if (!this.isAvailable()) {
      throw new Error("ShipNow no está configurado");
    }

    const request: ShipnowQuoteRequest = {
      origin,
      destination,
      packages: [{
        weight: packageSummary.totalWeightGrams / 1000, // Convertir a kg
        height: Math.round(packageSummary.heightCm),
        width: Math.round(packageSummary.widthCm),
        length: Math.round(packageSummary.lengthCm),
      }],
    };

    logger.info("Solicitando cotizaciones a ShipNow", { destination: destination.city });

    try {
      const response = await this.fetch("/rates", {
        method: "POST",
        body: JSON.stringify(request),
      }) as ShipnowQuoteResponse;

      logger.info("Cotizaciones ShipNow obtenidas", { count: response.rates.length });
      return response.rates;
    } catch (error) {
      logger.error("Error al obtener cotizaciones ShipNow", { error: (error as Error).message });
      throw error;
    }
  }

  async createShipment(
    rateId: string,
    origin: ShipnowAddress,
    destination: ShipnowAddress,
    packageSummary: PackageSummary,
    orderId: string,
    reference?: string
  ): Promise<ShipnowShipment> {
    if (!this.isAvailable()) {
      throw new Error("ShipNow no está configurado");
    }

    const request: ShipnowShipmentRequest = {
      rate_id: rateId,
      origin,
      destination,
      packages: [{
        weight: packageSummary.totalWeightGrams / 1000,
        height: Math.round(packageSummary.heightCm),
        width: Math.round(packageSummary.widthCm),
        length: Math.round(packageSummary.lengthCm),
      }],
      order_id: orderId,
      reference,
    };

    logger.info("Creando envío en ShipNow", { orderId, rateId });

    try {
      const response = await this.fetch("/shipments", {
        method: "POST",
        body: JSON.stringify(request),
      }) as ShipnowShipmentResponse;

      logger.info("Envío ShipNow creado", { 
        shipmentId: response.shipment.id,
        trackingCode: response.shipment.tracking_code 
      });

      return response.shipment;
    } catch (error) {
      logger.error("Error al crear envío ShipNow", { error: (error as Error).message });
      throw error;
    }
  }

  async getShipmentStatus(shipmentId: string): Promise<ShipnowStatusResponse> {
    if (!this.isAvailable()) {
      throw new Error("ShipNow no está configurado");
    }

    logger.info("Consultando estado de envío ShipNow", { shipmentId });

    try {
      const response = await this.fetch(`/shipments/${shipmentId}/tracking`) as ShipnowStatusResponse;
      return response;
    } catch (error) {
      logger.error("Error al consultar estado ShipNow", { error: (error as Error).message });
      throw error;
    }
  }

  async getLabel(shipmentId: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error("ShipNow no está configurado");
    }

    try {
      const response = await this.fetch(`/shipments/${shipmentId}/label`) as { url: string };
      return response.url;
    } catch (error) {
      logger.error("Error al obtener etiqueta ShipNow", { error: (error as Error).message });
      throw error;
    }
  }
}

export const shipnowService = new ShipnowService();

// Exportar tipos para uso en otros módulos
export type {
  ShipnowAddress,
  ShipnowPackage,
  ShipnowRate,
  ShipnowShipment,
};
