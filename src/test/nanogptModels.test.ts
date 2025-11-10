import * as assert from "assert";
import * as vscode from "vscode";
import { NanoGPTModelsService } from "../nanogptModels";
import { NanoGPTModelsResponseSchema } from "../types";
import { z } from "zod";

suite("NanoGPT Models Service Tests", () => {
	let modelsService: NanoGPTModelsService;

	setup(() => {
		modelsService = new NanoGPTModelsService("test-user-agent");
	});

	test("should create service with user agent", () => {
		const service = new NanoGPTModelsService("custom-user-agent");
		assert.ok(service, "Service should be created");
	});

	test("should return undefined for missing API key when silent", async () => {
		// Mock secret storage
		const mockSecrets = {
			get: async (_key: string) => {
				return undefined;
			},
			store: async (_key: string, _value: string) => {},
			delete: async (_key: string) => {},
			onDidChange: {
				dispose: () => {}
			}
		} as unknown as vscode.SecretStorage;

		const result = await modelsService.ensureApiKey(mockSecrets, true);
		assert.strictEqual(result, undefined, "Should return undefined when API key is missing and silent is true");
	});

	test("should handle fetch models error", async () => {
		const apiKey = "e4a238f8-a9cd-41c0-990e-5b6230d97c99";

		// Mock fetch to return error
		const originalFetch = global.fetch;
		global.fetch = async () => {
			return {
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				text: async () => "Invalid API key"
			} as Response;
		};

		try {
			await modelsService.fetchModels(apiKey);
			assert.fail("Should have thrown an error");
		} catch (error) {
			assert.ok(error instanceof Error, "Should throw an Error");
			assert.match((error as Error).message, /Failed to fetch NanoGPT models/, "Error message should indicate failure");
		} finally {
			global.fetch = originalFetch;
		}
	});

	test("should prepare language model chat information with no API key", async () => {
		const mockSecrets = {
			get: async (key: string) => undefined,
			store: async (key: string, value: string) => {},
			delete: async (key: string) => {},
			onDidChange: {
				// @ts-ignore - Mock event emitter
				dispose: () => {}
			}
		} as unknown as vscode.SecretStorage;

		const mockToken = new vscode.CancellationTokenSource().token;

		const result = await modelsService.prepareLanguageModelChatInformation(
			mockSecrets,
			{ silent: true },
			mockToken
		);

		assert.deepStrictEqual(result, [], "Should return empty array when no API key is available");
	});

	test("should prepare language model chat information correctly", async () => {
		const mockSecrets = {
			get: async (key: string) => "test-api-key",
			store: async (key: string, value: string) => {},
			delete: async (key: string) => {},
			onDidChange: {
				// @ts-ignore - Mock event emitter
				dispose: () => {}
			}
		} as unknown as vscode.SecretStorage;

		const mockToken = new vscode.CancellationTokenSource().token;

		const validApiResponse = {
			"object": "list",
			"data": [
				{
					"id": "gpt-4o",
					"object": "model",
					"created": 1234567890,
					"owned_by": "openai",
					"vision": true,
					"supported_features": ["tools"]
				},
				{
					"id": "gpt-4o-mini",
					"object": "model",
					"created": 1234567890,
					"owned_by": "openai",
					"context_length": 8000
				}
			]
		};

		const originalFetch = global.fetch;
		global.fetch = async () => {
			return {
				ok: true,
				json: async () => validApiResponse
			} as Response;
		};

		try {
			const result = await modelsService.prepareLanguageModelChatInformation(
				mockSecrets,
				{ silent: true },
				mockToken
			);

			assert.strictEqual(result.length, 2, "Should return 2 models");

			const model1 = result[0];
			assert.strictEqual(model1.id, "gpt-4o", "Model 1 ID should be correct");
			assert.strictEqual(model1.capabilities.imageInput, true, "Model 1 should have vision");
			assert.strictEqual(model1.capabilities.toolCalling, true, "Model 1 should have tool calling");

			const model2 = result[1];
			assert.strictEqual(model2.id, "gpt-4o-mini", "Model 2 ID should be correct");
			assert.strictEqual(model2.maxInputTokens, 8000, "Model 2 should have correct context length");
			assert.strictEqual(model2.capabilities.imageInput, false, "Model 2 should not have vision");
			assert.strictEqual(model2.capabilities.toolCalling, false, "Model 2 should not have tool calling");

		} finally {
			global.fetch = originalFetch;
		}
	});

	suite("Zod Validation Tests", () => {
		const validApiResponse = {
			"object": "list",
			"data": [
				{
					"id": "gpt-4o",
					"object": "model",
					"created": 1234567890,
					"owned_by": "openai"
				},
				{
					"id": "gpt-4o-mini",
					"object": "model",
					"created": 1234567890,
					"owned_by": "openai"
				},
				{
					"id": "claude-3-5-sonnet",
					"object": "model",
					"created": 1234567890,
					"owned_by": "anthropic"
				}
			]
		};

		test("should validate correct API response format", async () => {
			const apiKey = "e4a238f8-a9cd-41c0-990e-5b6230d97c99";

			// Mock fetch to return valid response
			const originalFetch = global.fetch;
			global.fetch = async () => {
				return {
					ok: true,
					json: async () => validApiResponse
				} as Response;
			};

			try {
				const result = await modelsService.fetchModels(apiKey);
				assert.ok(result, "Should return result object");
				assert.ok(result.models, "Should return models array");
				assert.strictEqual(result.models.length, 3, "Should return 3 models");
				assert.strictEqual(result.models[0].id, "gpt-4o", "Should have correct first model ID");
			} finally {
				global.fetch = originalFetch;
			}
		});

		test("should reject API response missing required 'id' field", async () => {
			const apiKey = "e4a238f8-a9cd-41c0-990e-5b6230d97c99";
			const invalidResponse = {
				"object": "list",
				"data": [
					{
						"object": "model",
						"created": 1234567890,
						"owned_by": "openai"
						// Missing 'id' field
					}
				]
			};

			const originalFetch = global.fetch;
			global.fetch = async () => {
				return {
					ok: true,
					json: async () => invalidResponse
				} as Response;
			};

			try {
				await modelsService.fetchModels(apiKey);
				assert.fail("Should have thrown a validation error");
			} catch (error) {
				assert.ok(error instanceof Error, "Should throw an Error");
				assert.match((error as Error).message, /Invalid API response format/, "Error message should indicate validation failure");
			} finally {
				global.fetch = originalFetch;
			}
		});

		test("should reject API response missing required 'object' field", async () => {
			const apiKey = "e4a238f8-a9cd-41c0-990e-5b6230d97c99";
			const invalidResponse = {
				"data": [
					{
						"id": "gpt-4o",
						"created": 1234567890,
						"owned_by": "openai"
						// Missing 'object' field
					}
				]
			};

			const originalFetch = global.fetch;
			global.fetch = async () => {
				return {
					ok: true,
					json: async () => invalidResponse
				} as Response;
			};

			try {
				await modelsService.fetchModels(apiKey);
				assert.fail("Should have thrown a validation error");
			} catch (error) {
				assert.ok(error instanceof Error, "Should throw an Error");
				assert.match((error as Error).message, /Invalid API response format/, "Error message should indicate validation failure");
			} finally {
				global.fetch = originalFetch;
			}
		});

		test("should reject API response with wrong data type for 'id' field", async () => {
			const apiKey = "e4a238f8-a9cd-41c0-990e-5b6230d97c99";
			const invalidResponse = {
				"object": "list",
				"data": [
					{
						"id": 123, // Should be string, not number
						"object": "model",
						"created": 1234567890,
						"owned_by": "openai"
					}
				]
			};

			const originalFetch = global.fetch;
			global.fetch = async () => {
				return {
					ok: true,
					json: async () => invalidResponse
				} as Response;
			};

			try {
				await modelsService.fetchModels(apiKey);
				assert.fail("Should have thrown a validation error");
			} catch (error) {
				assert.ok(error instanceof Error, "Should throw an Error");
				assert.match((error as Error).message, /Invalid API response format/, "Error message should indicate validation failure");
			} finally {
				global.fetch = originalFetch;
			}
		});

		test("should reject API response missing 'data' field", async () => {
			const apiKey = "e4a238f8-a9cd-41c0-990e-5b6230d97c99";
			const invalidResponse = {
				// Missing 'data' field
				"object": "list"
			};

			const originalFetch = global.fetch;
			global.fetch = async () => {
				return {
					ok: true,
					json: async () => invalidResponse
				} as Response;
			};

			try {
				await modelsService.fetchModels(apiKey);
				assert.fail("Should have thrown a validation error");
			} catch (error) {
				assert.ok(error instanceof Error, "Should throw an Error");
				assert.match((error as Error).message, /Invalid API response format/, "Error message should indicate validation failure");
			} finally {
				global.fetch = originalFetch;
			}
		});

		test("should reject API response with 'data' as non-array", async () => {
			const apiKey = "e4a238f8-a9cd-41c0-990e-5b6230d97c99";
			const invalidResponse = {
				"object": "list",
				"data": "not-an-array" // Should be array, not string
			};

			const originalFetch = global.fetch;
			global.fetch = async () => {
				return {
					ok: true,
					json: async () => invalidResponse
				} as Response;
			};

			try {
				await modelsService.fetchModels(apiKey);
				assert.fail("Should have thrown a validation error");
			} catch (error) {
				assert.ok(error instanceof Error, "Should throw an Error");
				assert.match((error as Error).message, /Invalid API response format/, "Error message should indicate validation failure");
			} finally {
				global.fetch = originalFetch;
			}
		});

		test("should reject API response with individual model 'object' as non-string", async () => {
			const apiKey = "e4a238f8-a9cd-41c0-990e-5b6230d97c99";
			const invalidResponse = {
				"object": "list",
				"data": [
					{
						"id": "test-model",
						"object": 123, // Should be string, not number
						"created": 1234567890,
						"owned_by": "openai"
					}
				]
			};

			const originalFetch = global.fetch;
			global.fetch = async () => {
				return {
					ok: true,
					json: async () => invalidResponse
				} as Response;
			};

			try {
				await modelsService.fetchModels(apiKey);
				assert.fail("Should have thrown a validation error");
			} catch (error) {
				assert.ok(error instanceof Error, "Should throw an Error");
				assert.match((error as Error).message, /Invalid API response format/, "Error message should indicate validation failure");
			} finally {
				global.fetch = originalFetch;
			}
		});

		test("should throw error when data array is empty", async () => {
			const apiKey = "e4a238f8-a9cd-41c0-990e-5b6230d97c99";
			const emptyResponse = {
				"object": "list",
				"data": []
			};

			const originalFetch = global.fetch;
			global.fetch = async () => {
				return {
					ok: true,
					json: async () => emptyResponse
				} as Response;
			};

			try {
				await modelsService.fetchModels(apiKey);
				assert.fail("Should have thrown an error for empty data array");
			} catch (error) {
				assert.ok(error instanceof Error, "Should throw an Error");
				assert.match((error as Error).message, /No models data found/, "Error message should indicate no models found");
			} finally {
				global.fetch = originalFetch;
			}
		});

		test("should validate schema directly using Zod", () => {
			// Test valid data
			const validResult = NanoGPTModelsResponseSchema.safeParse(validApiResponse);
			assert.ok(validResult.success, "Valid data should pass validation");
			if (validResult.success) {
				assert.strictEqual(validResult.data.data.length, 3, "Should parse 3 models");
				assert.strictEqual(validResult.data.data[0].id, "gpt-4o", "Should parse first model ID correctly");
			}

			// Test invalid data
			const invalidData = { data: [{ id: "test" }] }; // Missing object field
			const invalidResult = NanoGPTModelsResponseSchema.safeParse(invalidData);
			assert.ok(!invalidResult.success, "Invalid data should fail validation");
			if (!invalidResult.success) {
				assert.ok(invalidResult.error instanceof z.ZodError, "Should return ZodError");
			}
		});
	});
});