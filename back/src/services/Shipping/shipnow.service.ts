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

interface ShipnowShippingOptionsRequest {
  weight: number;
  to_zip_code?: string;
  from_zip_code?: string;
  mode: "delivery" | "exchange";
  categories: string;
  types: string;
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

interface ShipnowShippingOption {
  minimum_delivery?: string;
  maximum_delivery?: string;
  price: number;
  tax_price?: number;
  shipping_contract?: {
    id: number;
    status: string;
    account?: {
      id: number;
    };
    shipping_service?: {
      id: number;
    };
  };
  shipping_service?: {
    id: number;
    code: string;
    description: string;
    type: string;
    mode: string;
    category: string;
    carrier?: {
      code: string;
      description: string;
      flexible_dispatching: boolean;
      id: number;
      image_url: string | null;
      name: string;
      tracking_url: string;
    };
  };
}

interface ShipnowShippingOptionsResponse {
  results?: ShipnowShippingOption[];
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

const SHIPNOW_API_URL = "https://api.shipnow.com.ar";
const SHIPNOW_SHIPPING_OPTIONS_ENDPOINT = "/shipping_options";
const SHIPNOW_SHIPMENTS_ENDPOINT = "/v1/shipments";
const SHIPNOW_DEFAULT_TYPES = "ship_pap";
const SHIPNOW_DEFAULT_CATEGORIES = "economic";

const SHIPNOW_API_TOKEN = env.SHIPNOW_API_TOKEN || "";

const mapShippingOptionToRate = (option: ShipnowShippingOption): ShipnowRate | null => {
  const shippingService = option.shipping_service;
  const carrier = shippingService?.carrier;

  if (!shippingService?.code || !shippingService.description || !carrier?.name) {
    logger.warn("Opción de ShipNow omitida por respuesta incompleta", {
      shippingServiceId: shippingService?.id,
      shippingContractId: option.shipping_contract?.id,
    });
    return null;
  }

  return {
    id: shippingService.code,
    carrier: carrier.name,
    service: shippingService.description,
    service_code: shippingService.code,
    price: option.tax_price ?? option.price,
    currency: "ARS",
    estimated_delivery: option.minimum_delivery ?? option.maximum_delivery ?? "",
    tracking_available: Boolean(carrier.tracking_url),
  };
};

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
      "Accept": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

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

    const request: ShipnowShippingOptionsRequest = {
      weight: Math.max(1, Math.round(packageSummary.totalWeightGrams)),
      to_zip_code: destination.postal_code.trim(),
      mode: "delivery",
      categories: SHIPNOW_DEFAULT_CATEGORIES,
      types: SHIPNOW_DEFAULT_TYPES,
    };

    const query = new URLSearchParams({
      weight: String(request.weight),
      to_zip_code: request.to_zip_code ?? "",
      mode: request.mode,
      categories: request.categories,
      types: request.types,
    });

    logger.info("Solicitando cotizaciones a ShipNow", {
      originPostalCode: origin.postal_code,
      destinationPostalCode: destination.postal_code,
      weightGrams: request.weight,
    });

    try {
      const response = await this.fetch(`${SHIPNOW_SHIPPING_OPTIONS_ENDPOINT}?${query.toString()}`, {
        method: "GET",
      }) as ShipnowShippingOptionsResponse;

      const rates = (response.results ?? [])
        .map(mapShippingOptionToRate)
        .filter((rate): rate is ShipnowRate => rate !== null);

      logger.info("Cotizaciones ShipNow obtenidas", { count: rates.length });
      return rates;
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
      const response = await this.fetch(SHIPNOW_SHIPMENTS_ENDPOINT, {
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
      const response = await this.fetch(`${SHIPNOW_SHIPMENTS_ENDPOINT}/${shipmentId}/tracking`) as ShipnowStatusResponse;
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
      const response = await this.fetch(`${SHIPNOW_SHIPMENTS_ENDPOINT}/${shipmentId}/label`) as { url: string };
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
