import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Truck, Package, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface ShipnowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  loading?: boolean;
}

const CARRIERS = [
  { name: 'Andreani', description: 'Líder en logística nacional con amplia cobertura' },
  { name: 'OCA', description: 'Servicio postal tradicional de Argentina' },
  { name: 'Correo Argentino', description: 'Servicio postal estatal con amplia cobertura' },
  { name: 'Mensajería Privada', description: 'Servicios de mensajería express' },
  { name: 'Courier Local', description: 'Entregas locales rápidas' },
];

const PROHIBITED_ITEMS = [
  'Armas de fuego, municiones y explosivos',
  'Drogas y sustancias ilegales',
  'Animales vivos (excepto autorizados)',
  'Alimentos perecederos sin envase adecuado',
  'Productos químicos peligrosos',
  'Baterías de litio sueltas',
  'Documentos de identidad y pasaportes',
  'Joyas y objetos de valor excesivo sin seguro',
  'Efectivo y cheques',
  'Cajas con más de 25kg de peso',
  'Líquidos sin tapa hermética',
  'Productos refrigerados sin cadena de frío',
];

export function ShipnowModal({ isOpen, onClose, onAccept, loading }: ShipnowModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Integrar ShipNow</DialogTitle>
              <DialogDescription>
                Cotizá envíos con múltiples couriers desde una sola plataforma
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="px-6 max-h-[60vh]">
          <div className="space-y-6 pb-4">
            {/* Qué es ShipNow */}
            <section className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" />
                ¿Qué es ShipNow?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ShipNow es una plataforma logística que te permite cotizar y gestionar envíos 
                con múltiples couriers desde un solo lugar. Comparás precios en tiempo real, 
                elegís el mejor servicio y gestionás todo tu logística de forma centralizada.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Cotizaciones en tiempo real</Badge>
                <Badge variant="secondary">Múltiples couriers</Badge>
                <Badge variant="secondary">Tracking automático</Badge>
                <Badge variant="secondary">Etiquetas integradas</Badge>
              </div>
            </section>

            {/* Proveedores */}
            <section className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Couriers disponibles
              </h3>
              <div className="grid gap-2">
                {CARRIERS.map((carrier) => (
                  <div
                    key={carrier.name}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{carrier.name}</p>
                      <p className="text-xs text-muted-foreground">{carrier.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                * La disponibilidad de couriers puede variar según la zona de origen y destino.
              </p>
            </section>

            {/* Objetos prohibidos */}
            <section className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Objetos prohibidos
              </h3>
              <p className="text-sm text-muted-foreground">
                Los siguientes artículos <strong>no pueden</strong> ser enviados a través de ShipNow:
              </p>
              <div className="grid gap-1.5">
                {PROHIBITED_ITEMS.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <span className="text-red-500">•</span>
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Responsabilidad */}
            <section className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Tus responsabilidades
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Empaquetar correctamente los productos para evitar daños</li>
                <li>Ingresar pesos y dimensiones reales de los paquetes</li>
                <li>No enviar productos prohibidos o restringidos</li>
                <li>Declarar el valor real del contenido para el seguro</li>
                <li>Estar presente en la dirección de retiro en el horario acordado</li>
                <li>Pagar los envíos generados según los términos de ShipNow</li>
              </ul>
            </section>

            {/* Disclaimer */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs text-amber-800 leading-relaxed">
                Al aceptar, confirmás que leíste y entendés los términos de uso de ShipNow. 
                La plataforma pragmatienda actúa como intermediario tecnológico, pero los envíos 
                son gestionados directamente por ShipNow y los couriers asociados. Los precios 
                y tiempos de entrega son responsabilidad de los couriers y pueden variar según 
                la zona, peso y dimensiones del paquete.
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onAccept} disabled={loading} className="gap-2">
            {loading ? (
              'Aceptando...'
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Aceptar y habilitar ShipNow
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
