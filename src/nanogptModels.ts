import * as vscode from "vscode";
import type { NanoGPTModelDetails } from "./types";
import { NanoGPTModelsResponseSchema } from "./types";
import { CancellationToken, LanguageModelChatInformation } from "vscode";
import { tryit } from "radash";

export const BASE_URL = "https://nano-gpt.com/api/v1";
export const DEFAULT_CONTEXT_LENGTH = 128000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 16000;
export const MAX_TOOLS = 128;

type BaseCapabilities = import("vscode").LanguageModelChatInformation["capabilities"];

const DEFAULT_CAPABILITIES: BaseCapabilities = {
	toolCalling: true,
	imageInput: false,
};

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
     * @param apiKey The NanoGPT API key used to authenticate.
     */
    async fetchModels(apiKey: string): Promise<{ models: NanoGPTModelDetails[] }> {
			try {
				const response = await fetch(`${BASE_URL}/models?detailed=true`, {
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"User-Agent": this.userAgent,
					},
				});
				if (!response.ok) {
                const errorText = await response.text();
                console.error("[NanoGPT Model Provider] Failed to fetch NanoGPT models", {
                    status: response.status,
                    statusText: response.statusText,
                    detail: errorText,
                });

                // Emit user-friendly error message
                vscode.window.showInformationMessage(
                    `Failed to fetch models from NanoGPT (${response.status}): ${response.statusText || 'Network error'}. Please check your API key and internet connection.`
                );

                throw new Error(
                    `Failed to fetch NanoGPT models: ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${errorText ? `\n${errorText}` : ""}`
                );
            }

            // Fetch and PARSE the data using the schema
            const rawData = await response.json();
            const [err, data] = tryit(() => NanoGPTModelsResponseSchema.parse(rawData))();
						if (err) {
              console.error("[NanoGPT Model Provider] Model data validation failed:", err);

              // Emit user-friendly error message
              vscode.window.showInformationMessage(
                  `Failed to parse model data from NanoGPT API. The API response format may have changed. Please try again later.`
              );

              throw new Error(
                  `Invalid API response format from NanoGPT: ${err instanceof Error ? err.message : 'Unknown validation error'}`
              );
            }

            const models = data?.data;
            if (!models || models.length === 0) {
                throw new Error("No models data found in validated API response");
            }
            return { models };
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw error;
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
			console.log(`[NanoGPT Model Provider] Fetched ${models?.length || 0} models from API`);
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

				const modelInfo: LanguageModelChatInformation = {
					id: m.id,
					name: m.id,
					tooltip: m.owned_by ? `Owned by ${m.owned_by}` : "NanoGPT Model",
					detail: "NanoGPT.com",
					family: "nanogpt",
					version: "1.0.0",
					maxInputTokens: m.context_length ?? DEFAULT_CONTEXT_LENGTH,
					maxOutputTokens: m.max_output_length ?? DEFAULT_MAX_OUTPUT_TOKENS,
					capabilities,
				};

				infos.push(modelInfo);
				console.log(`[NanoGPT Model Provider] Successfully processed model: ${m.id}`);
			} catch (error) {
				console.error(`[NanoGPT Model Provider] Failed to process model ${m.id}:`, error);
				// For debugging, let's still try to add a basic model info
				try {
					const fallbackInfo: LanguageModelChatInformation = {
						id: m.id || `model-${infos.length}`,
						name: m.id || `Model ${infos.length + 1}`,
						tooltip: "NanoGPT Model",
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