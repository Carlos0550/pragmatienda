import Groq from "groq-sdk";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import type { MetadataSchema, ProductNameAnalysis } from "./seo.zod";

export type ProductMetadata = MetadataSchema;

const getClient = () =>
  env.GROQ_API_KEY?.trim() ? new Groq({ apiKey: env.GROQ_API_KEY! }) : null;

/* -------------------------------------------------------------------------- */
/*                         ANÁLISIS DE NOMBRE                                 */
/* -------------------------------------------------------------------------- */

export async function analyzeProductName(name: string): Promise<ProductNameAnalysis | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const prompt = `
Eres un experto en naming y SEO para ecommerce.

Analiza el nombre del producto y determina si es demasiado genérico para destacar en un catálogo.

NOMBRE A ANALIZAR:
"${name}"

CRITERIOS DE NOMBRE GENÉRICO:
- Una sola palabra sin contexto (ej: "Camiseta", "Zapato")
- Frases que solo describen la categoría sin diferenciar (ej: "Pestañas postizas", "Aceite de cocina")
- Falta de marca, modelo o característica distintiva
- Sin atributos: color, material, estilo, tipo, uso específico
- Nombres que podrían aplicarse a miles de productos iguales
- No permite distinguir este producto de otros del mismo tipo

CRITERIOS DE BUEN NOMBRE:
- Incluye marca, modelo o referencia identificable
- Atributos relevantes: material, color, estilo, tipo, uso
- Específico y descriptivo (ej: "Pestañas postizas efecto natural marca X", "Aceite de oliva virgen extra 1L")
- Diferencia el producto de otros similares
- Facilita la búsqueda y decisión del cliente

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin texto extra):

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

    return {
      isGeneric: Boolean(parsed.isGeneric),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      message: typeof parsed.message === "string" ? parsed.message : "",
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
