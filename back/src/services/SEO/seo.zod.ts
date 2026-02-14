import { z } from "zod";

export type ProductNameAnalysis = {
  isGeneric: boolean;
  suggestions: string[];
  message: string;
};

export const metadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.string().optional()
}).passthrough();

export type MetadataSchema = z.infer<typeof metadataSchema>;
