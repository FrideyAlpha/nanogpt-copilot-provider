import { z } from "zod";

const ModelFeatureSpec = z.literal("tools")
  .or(z.literal("json_mode"))
  .or(z.literal("structured_outputs"))
  .or(z.literal("web_search"))
  .or(z.literal("reasoning"));

const SamplingParameterSpec = z.literal("temperature")
  .or(z.literal("top_p"))
  .or(z.literal("top_k"))
  .or(z.literal("repetition_penalty"))
  .or(z.literal("frequency_penalty"))
  .or(z.literal("presence_penalty"))
  .or(z.literal("stop"))
  .or(z.literal("seed"));



// NanoGPT Model Details Schema (OpenAI-compatible)
const NanoGPTModelDetailsSchema = z.object({
	// Required OpenAI-compatible params
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	object: z.string().default("model"),
	created: z.number().optional(),

	// Model properties
	owned_by: z.string().optional(),

	// Optional fields for vision and other capabilities
	vision: z.boolean().optional(),

	// Context and output limits - API may return null for some models
	context_length: z.number().nullable().optional(),
	max_output_length: z.number().nullable().optional(),

	// Pricing information (optional) - API returns numbers, not strings
	pricing: z.object({
		prompt: z.number().optional(),
		completion: z.number().optional(),
		image: z.number().optional(),
		request: z.number().optional(),
	}).optional(),

	// Supported features
	supported_features: z.array(ModelFeatureSpec).optional(),
	supported_sampling_parameters: z.array(SamplingParameterSpec).optional(),
});
export type NanoGPTModelDetails = z.infer<typeof NanoGPTModelDetailsSchema>;

// Zod schema for validating the NanoGPTModelsResponse
export const NanoGPTModelsResponseSchema = z.object({
	object: z.string(),
	data: z.array(NanoGPTModelDetailsSchema),
});

// Model Types Configuration
export type ModelType = "all" | "premium" | "subscription";

// Model categorization based on endpoint source
export interface CategorizedModel extends NanoGPTModelDetails {
	endpoint: string;
	category: ModelType;
}

// API endpoints for different model types
export const MODEL_ENDPOINTS = {
	all: "/models?detailed=true",
	premium: "https://nano-gpt.com/api/paid/v1/models?detailed=true",
	subscription: "https://nano-gpt.com/api/subscription/v1/models?detailed=true"
} as const;

// API endpoint configuration
export interface EndpointConfig {
	url: string;
	category: ModelType;
	displayName: string;
	description: string;
}

// Retry configuration
export interface RetryConfig {
	maxAttempts: number;
	delayMs: number;
	backoffMultiplier: number;
}

// NanoGPT Configuration Schema
export const NanoGPTConfigurationSchema = z.object({
	reasoning: z.object({
		enabled: z.boolean().default(true),
		defaultEffort: z.enum(["low", "medium", "high"]).default("medium"),
	}).default({ enabled: true, defaultEffort: "medium" }),

	memory: z.object({
		enabled: z.boolean().default(true),
		defaultDays: z.number().min(1).max(365).default(30),
	}).default({ enabled: true, defaultDays: 30 }),

	search: z.object({
		enabled: z.boolean().default(true),
		defaultMode: z.enum(["standard", "deep"]).default("standard"),
	}).default({ enabled: true, defaultMode: "standard" }),

	byok: z.object({
		enabled: z.boolean().default(false),
		defaultProvider: z.enum(["openai", "anthropic", "google"]).default("openai"),
	}).default({ enabled: false, defaultProvider: "openai" }),
});
