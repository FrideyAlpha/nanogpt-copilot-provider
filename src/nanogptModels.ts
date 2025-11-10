import * as vscode from "vscode";
import type { ModelType, CategorizedModel, EndpointConfig, RetryConfig } from "./types";
import { NanoGPTModelsResponseSchema, MODEL_ENDPOINTS } from "./types";
import { CancellationToken, LanguageModelChatInformation } from "vscode";
import { tryit } from "radash";

export const BASE_URL = "https://nano-gpt.com/api/v1";
export const DEFAULT_CONTEXT_LENGTH = 128000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 16000;
export const MAX_TOOLS = 128;

// Retry configuration
const RETRY_CONFIG: RetryConfig = {
	maxAttempts: 3,
	delayMs: 1000,
	backoffMultiplier: 2
};

// Endpoint configurations
export const ENDPOINT_CONFIGS: Record<ModelType, EndpointConfig> = {
	all: {
		url: `${BASE_URL}${MODEL_ENDPOINTS.all}`,
		category: "all",
		displayName: "All Models",
		description: "Access to all available NanoGPT models"
	},
	premium: {
		url: MODEL_ENDPOINTS.premium,
		category: "premium",
		displayName: "Premium Models",
		description: "Access to premium NanoGPT models"
	},
	subscription: {
		url: MODEL_ENDPOINTS.subscription,
		category: "subscription",
		displayName: "Subscription Models",
		description: "Access to subscription-based NanoGPT models"
	}
};

type BaseCapabilities = import("vscode").LanguageModelChatInformation["capabilities"];

const DEFAULT_CAPABILITIES: BaseCapabilities = {
	toolCalling: true,
	imageInput: false,
};

/**
 * Utility function to implement retry logic with exponential backoff
 */
async function retryWithBackoff<T>(
	operation: () => Promise<T>,
	config: RetryConfig = RETRY_CONFIG
): Promise<T> {
	let lastError: Error;

	for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt === config.maxAttempts) {
				break;
			}

			// Calculate delay with exponential backoff
			const delay = config.delayMs * Math.pow(config.backoffMultiplier, attempt - 1);
			console.log(`[NanoGPT Model Provider] Attempt ${attempt} failed, retrying in ${delay}ms...`);
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}

	throw lastError!;
}

/**
 * Get the current model type configuration from VS Code settings
 */
function getCurrentModelType(): ModelType {
	const config = vscode.workspace.getConfiguration("nanogpt");
	return config.get<ModelType>("modelTypes") || "all";
}

/**
 * Fetch models from a specific endpoint with retry mechanism
 */
async function fetchModelsFromEndpoint(
	apiKey: string,
	endpoint: EndpointConfig,
	userAgent: string
): Promise<{ models: CategorizedModel[], endpoint: string }> {
	console.log(`[NanoGPT Model Provider] Fetching models from ${endpoint.displayName} endpoint: ${endpoint.url}`);

	const result = await retryWithBackoff(async () => {
		const response = await fetch(endpoint.url, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"User-Agent": userAgent,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
		}

		const rawData = await response.json();
		const [err, data] = tryit(() => NanoGPTModelsResponseSchema.parse(rawData))();

		if (err) {
			throw new Error(`API response validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
		}

		if (!data?.data || data.data.length === 0) {
			throw new Error("No models data found in API response");
		}

		// Add endpoint information to each model
		const categorizedModels: CategorizedModel[] = data.data.map(model => ({
			...model,
			endpoint: endpoint.url,
			category: endpoint.category
		}));

		return { models: categorizedModels, endpoint: endpoint.url };
	});

	return result;
}

export const DEFAULT_MODEL_DETAILS = {
	tooltip: "NanoGPT",
	family: "nanogpt",
	detail: "NanoGPT.com",
	version: "1.0.0",
	maxInputTokens: DEFAULT_CONTEXT_LENGTH,
	maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
	capabilities: DEFAULT_CAPABILITIES,
} satisfies Partial<import("vscode").LanguageModelChatInformation>;

/**
 * Service for handling model fetching and hydration from NanoGPT API
 */
export class NanoGPTModelsService {
    constructor(private readonly userAgent: string) {}

    /**
     * Ensure an API key exists in SecretStorage, optionally prompting the user when not silent.
     * @param secrets VS Code secret storage.
     * @param silent If true, do not prompt the user.
     */
    async ensureApiKey(secrets: vscode.SecretStorage, silent: boolean): Promise<string | undefined> {
        let apiKey = await secrets.get("nanogpt.apiKey");
        if (!apiKey && !silent) {
            const entered = await vscode.window.showInputBox({
                title: "NanoGPT API Key",
                prompt: "Enter your NanoGPT API key",
                ignoreFocusOut: true,
                password: true,
            });
            if (entered && entered.trim()) {
                apiKey = entered.trim();
                await secrets.store("nanogpt.apiKey", apiKey);
            }
        }
        return apiKey;
    }

/**
     * Fetch the list of models and supplementary metadata from NanoGPT.
     * Supports multiple endpoints with fallback mechanism.
     * @param apiKey The NanoGPT API key used to authenticate.
     */
    async fetchModels(apiKey: string): Promise<{ models: CategorizedModel[], endpoint: string }> {
		const modelType = getCurrentModelType();
		console.log(`[NanoGPT Model Provider] Current model type: ${modelType}`);

		// Try the configured endpoint first
		const primaryEndpoint = ENDPOINT_CONFIGS[modelType];

		try {
			console.log(`[NanoGPT Model Provider] Attempting to fetch from primary endpoint: ${primaryEndpoint.displayName}`);
			const result = await fetchModelsFromEndpoint(apiKey, primaryEndpoint, this.userAgent);
			console.log(`[NanoGPT Model Provider] Successfully fetched ${result.models.length} models from ${primaryEndpoint.displayName}`);
			return result;

		} catch (error) {
			console.warn(`[NanoGPT Model Provider] Primary endpoint ${primaryEndpoint.displayName} failed:`, error);

			// If the configured endpoint fails, try fallback endpoints
			const fallbackEndpoints: ModelType[] = [];
			if (modelType !== "all") {
				fallbackEndpoints.push("all");
			}
			if (modelType !== "premium") {
				fallbackEndpoints.push("premium");
			}
			if (modelType !== "subscription") {
				fallbackEndpoints.push("subscription");
			}

			// Remove the failed primary endpoint from fallbacks
			const availableFallbacks = fallbackEndpoints.filter(type => type !== modelType);

			for (const fallbackType of availableFallbacks) {
				const fallbackEndpoint = ENDPOINT_CONFIGS[fallbackType];

				try {
					console.log(`[NanoGPT Model Provider] Trying fallback endpoint: ${fallbackEndpoint.displayName}`);
					const result = await fetchModelsFromEndpoint(apiKey, fallbackEndpoint, this.userAgent);
					console.log(`[NanoGPT Model Provider] Successfully fetched ${result.models.length} models from fallback endpoint ${fallbackEndpoint.displayName}`);

					// Show informative message about fallback
					vscode.window.showInformationMessage(
						`Primary endpoint unavailable. Using ${fallbackEndpoint.displayName} instead.`
					);

					return result;

				} catch (fallbackError) {
					console.warn(`[NanoGPT Model Provider] Fallback endpoint ${fallbackEndpoint.displayName} also failed:`, fallbackError);
					continue;
				}
			}

			// If all endpoints fail, provide a comprehensive error message
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			const userMessage = `Failed to fetch models from all NanoGPT endpoints. Last error: ${errorMessage}. Please check your API key and internet connection.`;

			console.error("[NanoGPT Model Provider] All endpoints failed:", errorMessage);
			vscode.window.showErrorMessage(userMessage);

			throw new Error(`All NanoGPT endpoints failed. Primary: ${primaryEndpoint.displayName}. Last error: ${errorMessage}`);
		}
    }

	/**
	 * Get the list of available language models contributed by this provider
	 * @param secrets VS Code secret storage
	 * @param options Options which specify the calling context of this function
	 * @param token A cancellation token which signals if the user cancelled the request or not
	 * @returns A promise that resolves to the list of available language models
	 */
	async prepareLanguageModelChatInformation(
		secrets: vscode.SecretStorage,
		options: { silent: boolean },
		_token: CancellationToken
	): Promise<LanguageModelChatInformation[]> {
		console.log("[NanoGPT Model Provider] prepareLanguageModelChatInformation called with silent:", options.silent);

		const apiKey = await this.ensureApiKey(secrets, options.silent);
		if (!apiKey) {
			console.log("[NanoGPT Model Provider] No API key available, returning empty array");
			return [];
		}

		let models;
		try {
			console.log("[NanoGPT Model Provider] Fetching models from API...");
			const result = await this.fetchModels(apiKey);
			models = result.models;
			console.log(`[NanoGPT Model Provider] Fetched ${models?.length || 0} models from endpoint: ${result.endpoint}`);
		} catch (error) {
			console.error("[NanoGPT Model Provider] Failed to prepare model information:", error);

			if (!options.silent) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
				vscode.window.showInformationMessage(
					`Unable to load NanoGPT models: ${errorMessage}. Please check your API key and try again.`
				);
			}

			return [];
		}

		const infos: LanguageModelChatInformation[] = [];
		console.log(`[NanoGPT Model Provider] Processing ${models.length} models...`);

		for (const m of models) {
			console.log(`[NanoGPT Model Provider] Processing model:`, JSON.stringify(m, null, 2));

			try {
				// Skip models without required fields
				if (!m.id) {
					console.warn("[NanoGPT Model Provider] Skipping model without id:", m);
					continue;
				}

				const capabilities: BaseCapabilities = {
					toolCalling: true, // NanoGPT models support tools by default
					imageInput: m.vision ?? false,
				};

				// Enhanced tooltip with category information
				const categoryInfo = m.category ? ` [${m.category}]` : '';
				const ownerInfo = m.owned_by ? `Owned by ${m.owned_by}` : "NanoGPT Model";
				const tooltip = `${ownerInfo}${categoryInfo}`;

				const modelInfo: LanguageModelChatInformation = {
					id: m.id,
					name: m.name,
					tooltip,
					detail: "NanoGPT.com",
					family: "nanogpt",
					version: "1.0.0",
					maxInputTokens: m.context_length ?? DEFAULT_CONTEXT_LENGTH,
					maxOutputTokens: m.max_output_length ?? DEFAULT_MAX_OUTPUT_TOKENS,
					capabilities,
				};

				infos.push(modelInfo);
				console.log(`[NanoGPT Model Provider] Successfully processed model: ${m.id} from ${m.category} endpoint`);
			} catch (error) {
				console.error(`[NanoGPT Model Provider] Failed to process model ${m.id}:`, error);
				// For debugging, let's still try to add a basic model info
				try {
					const fallbackInfo: LanguageModelChatInformation = {
						id: m.id || `model-${infos.length}`,
						name: m.name || `Model ${infos.length + 1}`,
						tooltip: `NanoGPT Model${m.category ? ` [${m.category}]` : ''}`,
						detail: "NanoGPT.com",
						family: "nanogpt",
						version: "1.0.0",
						maxInputTokens: DEFAULT_CONTEXT_LENGTH,
						maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
						capabilities: DEFAULT_CAPABILITIES,
					};
					infos.push(fallbackInfo);
					console.log(`[NanoGPT Model Provider] Added fallback model info for: ${m.id}`);
				} catch (fallbackError) {
					console.error(`[NanoGPT Model Provider] Failed to create fallback for model ${m.id}:`, fallbackError);
				}
			}
		}

		console.log(`[NanoGPT Model Provider] Returning ${infos.length} model infos:`, infos.map(m => m.id));
		return infos;
	}
}