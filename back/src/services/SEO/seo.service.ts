import Groq from "groq-sdk";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import type { MetadataSchema, ProductNameAnalysis } from "./seo.zod";

export type ProductMetadata = MetadataSchema;

const getClient = () =>
  env.GROQ_API_KEY?.trim() ? new Groq({ apiKey: env.GROQ_API_KEY! }) : null;

const stopWords = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "para",
  "con",
  "sin",
  "y",
  "en",
  "por",
  "a",
  "un",
  "una",
  "unos",
  "unas",
]);

const hasClearDifferentiation = (name: string): boolean => {
  const originalTokens = name.trim().split(/\s+/).filter(Boolean);
  if (originalTokens.length < 2) return false;

  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;

  const meaningfulTokens = normalized
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));

  // If the name has enough meaningful words, it is likely differentiated.
  if (meaningfulTokens.length >= 3) return true;

  const hasMeasureOrModel =
    /\b\d+(\.\d+)?\s?(ml|g|gr|kg|l|lt|cm|mm|oz|xl|xxl|s|m)\b/i.test(normalized) ||
    /\b[a-z]+\d+[a-z0-9]*\b/i.test(normalized);

  const hasBrandLikeToken = originalTokens
    .slice(1)
    .some((token) => /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9-]{2,}$/.test(token));

  return meaningfulTokens.length >= 2 && (hasMeasureOrModel  || hasBrandLikeToken);
};

/* -------------------------------------------------------------------------- */
/*                         ANÁLISIS DE NOMBRE                                 */
/* -------------------------------------------------------------------------- */

export async function analyzeProductName(name: string): Promise<ProductNameAnalysis | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const prompt = `
Eres un experto en naming y SEO para ecommerce.

Analiza el nombre del producto y determina si es realmente demasiado genérico para destacar en un catálogo.

NOMBRE A ANALIZAR:
"${name}"

CRITERIOS DE NOMBRE GENÉRICO (usa criterio estricto):
- Una sola palabra o frase mínima sin contexto (ej: "Camiseta", "Zapato")
- Solo categoría básica sin ningún diferenciador real (ej: "Pestañas postizas", "Aceite de cocina")
- No incluye marca, modelo, variante, beneficio o uso específico
- Podría aplicarse de forma idéntica a miles de productos del mismo rubro

IMPORTANTE:
- Si el nombre incluye 2 o más atributos concretos (tipo + beneficio + marca, etc.), NO lo marques como genérico.
- Un nombre puede ser válido sin modelo técnico, siempre que tenga diferenciación comercial clara.
- Ante duda razonable, prioriza isGeneric=false para no bloquear la creación del producto.
- Ejemplo de nombre NO genérico: "Pestañas postizas autoadhesivas Cherimoya".

CRITERIOS DE BUEN NOMBRE:
- Incluye marca, modelo o referencia identificable
- Atributos relevantes: material, color, estilo, tipo, uso
- Específico y descriptivo (ej: "Pestañas postizas efecto natural marca X", "Aceite de oliva virgen extra 1L")
- Diferencia el producto de otros similares
- Facilita la búsqueda y decisión del cliente

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin texto extra):
No agregues marca ni características técnicas que no estén en el nombre.
Usa solo atributos genéricos seguros como:
color, tipo, uso, zona de aplicación.


{
  "isGeneric": boolean,
  "suggestions": ["sugerencia 1", "sugerencia 2", "sugerencia 3"],
  "message": "Mensaje breve para el usuario (1-2 oraciones) con el resumen y recomendación principal"
}

REGLAS:
- suggestions: 1 a 3 alternativas de nombre mejorado (solo si isGeneric es true, si no, array vacío)
- message: en español, directo y útil
- Si el nombre es bueno: isGeneric=false, suggestions=[], message positivo
`;

    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 220,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as ProductNameAnalysis;
    const shouldForceAllow = Boolean(parsed.isGeneric) && hasClearDifferentiation(name);

    return {
      isGeneric: shouldForceAllow ? false : Boolean(parsed.isGeneric),
      suggestions:
        shouldForceAllow || !Array.isArray(parsed.suggestions) ? [] : parsed.suggestions,
      message:
        shouldForceAllow
          ? "El nombre tiene diferenciadores suficientes para publicarse en catálogo."
          : typeof parsed.message === "string"
            ? parsed.message
            : "",
    };
  } catch (error) {
    logger.warn("Groq product name analysis failed", {
      error: (error as Error).message,
    });
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                         DESCRIPCIÓN                                        */
/* -------------------------------------------------------------------------- */

export async function generateProductDescription(
  name: string,
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const prompt = `
Eres un redactor experto en ecommerce.

Genera una descripción persuasiva y natural del producto.

PRODUCTO:
${name}

REGLAS:
- Entre 70 y 120 palabras
- Enfocada en beneficios reales
- No inventar características técnicas
- Usar vocabulario específico del tipo de producto
- Evitar frases genéricas como “producto de alta calidad”

ESTRUCTURA:
1. Qué es
2. Para quién es
3. Beneficio principal
4. Resultado de uso

FORMATO:
Texto plano en un solo párrafo.
Español neutro.
`;

    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.6,
      max_tokens: 180,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content?.trim();

    if (!content) return null;

    return content.replace(/\n+/g, " ").trim();
  } catch (error) {
    logger.warn("Groq description generation failed", {
      error: (error as Error).message,
    });
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                                METADATA                                    */
/* -------------------------------------------------------------------------- */

export async function generateProductMetadata(
  name: string,
  description?: string | null,
): Promise<ProductMetadata | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const prompt = `
Eres un especialista en SEO para ecommerce.

Genera metadata optimizada para intención de compra.

PRODUCTO:
Nombre: ${name}
Descripción: ${description || "no disponible"}

REGLAS SEO:

TITLE
- Máx 60 caracteres
- Incluir keyword principal
- Incluir marca o atributo si existe
- No usar “compra ahora” ni frases genéricas

META DESCRIPTION
- Entre 140 y 160 caracteres
- Incluir beneficio concreto
- Lenguaje natural
- Orientado a conversión

KEYWORDS
- 5 a 8 keywords
- Separadas por comas
- Incluir long-tail con intención de compra
- Solo términos relevantes al producto

RELEVANCIA SEMÁNTICA
- Usar únicamente vocabulario del tipo de producto
- No mezclar con otras categorías

FORMATO DE RESPUESTA
Responde SOLO con JSON válido:

{
"title": string,
"description": string,
"keywords": string
}

Si no puedes generar contenido válido responde:
{"title":"","description":"","keywords":""}
`;

    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 220,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as ProductMetadata;

    return {
      title: parsed.title || undefined,
      description: parsed.description || undefined,
      keywords: parsed.keywords || undefined,
    };
  } catch (error) {
    logger.warn("Groq SEO generation failed", {
      error: (error as Error).message,
    });
    return null;
  }
}
