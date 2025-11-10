import * as vscode from "vscode";
import type { ModelType } from "./types";
import { ENDPOINT_CONFIGS } from "./nanogptModels";

/**
 * Get the custom temperature for a given model
 * @param modelId The model ID to get the temperature for
 * @returns The custom temperature or undefined if not set
 */
export function getModelTemperature(modelId: string): number | undefined {
	const config = vscode.workspace.getConfiguration("nanogpt");
	const temperatures = config.get<Record<string, number>>("modelTemperatures");
	return temperatures?.[modelId];
}

/**
 * Set the custom temperature for a given model
 * @param modelId The model ID to set the temperature for
 * @param temperature The temperature value (0-2)
 */
export async function setModelTemperature(modelId: string, temperature: number | undefined): Promise<void> {
	const config = vscode.workspace.getConfiguration("nanogpt");
	// VS Code configuration values are returned as immutable/frozen objects.
	// Clone before mutating to avoid proxy/extensibility errors in tests/runtime.
	const existing = config.get<Record<string, number>>("modelTemperatures") || {};
	const temperatures: Record<string, number> = { ...existing };

	if (temperature === undefined) {
		delete temperatures[modelId];
	} else {
		temperatures[modelId] = temperature;
	}

	await config.update("modelTemperatures", temperatures, vscode.ConfigurationTarget.Global);
}

async function configureModelTemperature(secrets: vscode.SecretStorage): Promise<void> {
	// First, we need to get the list of available models
	const { NanoGPTModelsService } = await import("./nanogptModels.js");
	const modelsService = new NanoGPTModelsService("nanogpt-vscode-chat/config");

	const apiKey = await modelsService.ensureApiKey(secrets, false);
	if (!apiKey) {
		vscode.window.showInformationMessage("Please configure your NanoGPT API key first.");
		return;
	}

	try {
		const { models } = await modelsService.fetchModels(apiKey);

		if (!models || models.length === 0) {
			vscode.window.showInformationMessage("No models available.");
			return;
		}

		// Show quick pick to select a model
		interface ModelItem {
			label: string;
			description: string;
			modelId: string;
		}

		const config = vscode.workspace.getConfiguration("nanogpt");
		const modelItems: ModelItem[] = models.map((m) => {
			let description = getModelTemperature(m.id)?.toFixed(2) || "Default";
			if (config.get<boolean>("memory.enabled")) {
				description += ` / Mem: ${config.get<number>("memory.defaultDays")}d`;
			}
			if (config.get<boolean>("nanogpt.search.enabled")) {
				description += " / Search";
			}
			return {
				label: m.id,
				description,
				modelId: m.id
			};
		});

		const selectedModel = await vscode.window.showQuickPick(modelItems, {
			placeHolder: "Select a model to configure temperature",
			ignoreFocusOut: true
		});

		if (!selectedModel) {
			return; // User cancelled
		}

		// Show input box for temperature
		const currentTemp = getModelTemperature(selectedModel.modelId);
		const temperatureInput = await vscode.window.showInputBox({
			title: `Set Temperature for ${selectedModel.modelId}`,
			prompt: "Enter temperature value (0-2, or leave empty to use default)",
			value: currentTemp?.toString() || "",
			validateInput: (value) => {
				if (value === "") {
					return null; // Empty is valid (means use default)
				}
				const num = parseFloat(value);
				if (isNaN(num)) {
					return "Please enter a valid number";
				}
				if (num < 0 || num > 2) {
					return "Temperature must be between 0 and 2";
				}
				return null;
			},
			ignoreFocusOut: true
		});

		if (temperatureInput === undefined) {
			return; // User cancelled
		}

		// Save the temperature
		const temperature = temperatureInput === "" ? undefined : parseFloat(temperatureInput);
		await setModelTemperature(selectedModel.modelId, temperature);

		if (temperature === undefined) {
			vscode.window.showInformationMessage(`Temperature for ${selectedModel.modelId} reset to default.`);
		} else {
			vscode.window.showInformationMessage(`Temperature for ${selectedModel.modelId} set to ${temperature}.`);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		vscode.window.showErrorMessage(`Failed to configure temperature: ${errorMessage}`);
	}
}

async function configureReasoning(): Promise<void> {
	const config = vscode.workspace.getConfiguration("nanogpt");
	const isEnabled = config.get<boolean>("nanogpt.reasoning.enabled");

	const selected = await vscode.window.showQuickPick(
		[
			{ label: "Enable", picked: isEnabled },
			{ label: "Disable", picked: !isEnabled },
		],
		{ placeHolder: "Select reasoning state" }
	);

	if (!selected) {return;}

	const newIsEnabled = selected.label === "Enable";
	await config.update("nanogpt.reasoning.enabled", newIsEnabled, vscode.ConfigurationTarget.Global);

	if (newIsEnabled) {
		const effort = config.get<string>("nanogpt.reasoning.defaultEffort");
		const effortSelection = await vscode.window.showQuickPick(
			[
				{ label: "low", picked: effort === "low" },
				{ label: "medium", picked: effort === "medium" },
				{ label: "high", picked: effort === "high" },
			],
			{ placeHolder: "Select default effort for reasoning" }
		);
		if (effortSelection) {
			await config.update("nanogpt.reasoning.defaultEffort", effortSelection.label, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(`Reasoning enabled with ${effortSelection.label} effort.`);
		}
	} else {
		vscode.window.showInformationMessage("Reasoning disabled.");
	}
}

async function configureMemory(): Promise<void> {
	const config = vscode.workspace.getConfiguration("nanogpt");
	const isEnabled = config.get<boolean>("nanogpt.memory.enabled");

	const selected = await vscode.window.showQuickPick(
		[
			{ label: "Enable", picked: isEnabled },
			{ label: "Disable", picked: !isEnabled },
		],
		{ placeHolder: "Select memory state" }
	);

	if (!selected) {return;}

	const newIsEnabled = selected.label === "Enable";
	await config.update("nanogpt.memory.enabled", newIsEnabled, vscode.ConfigurationTarget.Global);

	if (newIsEnabled) {
		const days = config.get<number>("nanogpt.memory.defaultDays");
		const daysInput = await vscode.window.showInputBox({
			prompt: "Enter memory duration in days (1-365)",
			value: days?.toString() ?? "30",
			validateInput: (value) => {
				const num = parseInt(value, 10);
				if (isNaN(num) || num < 1 || num > 365) {
					return "Please enter a number between 1 and 365.";
				}
				return null;
			},
		});
		if (daysInput) {
			await config.update("nanogpt.memory.defaultDays", parseInt(daysInput, 10), vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(`Memory enabled for ${daysInput} days.`);
		}
	} else {
		vscode.window.showInformationMessage("Memory disabled.");
	}
}

async function configureSearch(): Promise<void> {
	const config = vscode.workspace.getConfiguration("nanogpt");
	const isEnabled = config.get<boolean>("nanogpt.search.enabled");

	const selected = await vscode.window.showQuickPick(
		[
			{ label: "Enable", picked: isEnabled },
			{ label: "Disable", picked: !isEnabled },
		],
		{ placeHolder: "Select search state" }
	);

	if (!selected) {return;}

	const newIsEnabled = selected.label === "Enable";
	await config.update("nanogpt.search.enabled", newIsEnabled, vscode.ConfigurationTarget.Global);

	if (newIsEnabled) {
		const mode = config.get<string>("nanogpt.search.defaultMode");
		const modeSelection = await vscode.window.showQuickPick(
			[
				{ label: "standard", picked: mode === "standard" },
				{ label: "deep", picked: mode === "deep" },
			],
			{ placeHolder: "Select search mode" }
		);
		if (modeSelection) {
			await config.update("nanogpt.search.defaultMode", modeSelection.label, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(`Search enabled in ${modeSelection.label} mode.`);
		}
	} else {
		vscode.window.showInformationMessage("Search disabled.");
	}
}

async function configureBYOK(): Promise<void> {
	const config = vscode.workspace.getConfiguration("nanogpt");
	const isEnabled = config.get<boolean>("nanogpt.byok.enabled");

	const selected = await vscode.window.showQuickPick(
		[
			{ label: "Enable", picked: isEnabled },
			{ label: "Disable", picked: !isEnabled },
		],
		{ placeHolder: "Select BYOK state" }
	);

	if (!selected) {return;}

	const newIsEnabled = selected.label === "Enable";
	await config.update("nanogpt.byok.enabled", newIsEnabled, vscode.ConfigurationTarget.Global);

	if (newIsEnabled) {
		const provider = config.get<string>("nanogpt.byok.defaultProvider");
		const providerSelection = await vscode.window.showQuickPick(
			[
				{ label: "openai", picked: provider === "openai" },
				{ label: "anthropic", picked: provider === "anthropic" },
				{ label: "google", picked: provider === "google" },
			],
			{ placeHolder: "Select BYOK provider" }
		);
		if (providerSelection) {
			await config.update("nanogpt.byok.defaultProvider", providerSelection.label, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(`BYOK enabled with ${providerSelection.label} provider.`);
		}
	} else {
		vscode.window.showInformationMessage("BYOK disabled.");
	}
}

async function configureModelTypes(): Promise<void> {
	const config = vscode.workspace.getConfiguration("nanogpt");
	const currentModelType = config.get<ModelType>("modelTypes") || "all";

	// Create QuickPick items for each model type
	const modelTypeOptions = [
		{
			label: "All Models",
			description: "Access to all available NanoGPT models",
			modelType: "all" as ModelType,
			picked: currentModelType === "all",
		},
		{
			label: "Premium Models",
			description: "Access to premium NanoGPT models",
			modelType: "premium" as ModelType,
			picked: currentModelType === "premium",
		},
		{
			label: "Subscription Models",
			description: "Access to subscription-based NanoGPT models",
			modelType: "subscription" as ModelType,
			picked: currentModelType === "subscription",
		},
	];

	const selected = await vscode.window.showQuickPick(modelTypeOptions, {
		placeHolder: "Select model type for API endpoints",
		ignoreFocusOut: true,
	});

	if (!selected) {
		return; // User cancelled
	}

	// Update the configuration
	await config.update("modelTypes", selected.modelType, vscode.ConfigurationTarget.Global);

	// Show confirmation message
	const endpointInfo = ENDPOINT_CONFIGS[selected.modelType as ModelType];
	vscode.window.showInformationMessage(
		`Model type set to ${selected.label}. API endpoint: ${endpointInfo.url}`
	);
}

export async function showNanoGPTConfigUI(secrets: vscode.SecretStorage): Promise<void> {
	const options: Record<string, () => Promise<void>> = {
		"Configure Model Types": configureModelTypes,
		"Configure Model Temperature": () => configureModelTemperature(secrets),
		"Configure Reasoning": configureReasoning,
		"Configure Memory": configureMemory,
		"Configure Search": configureSearch,
		"Configure BYOK": configureBYOK,
	};

	const selectedOption = await vscode.window.showQuickPick(Object.keys(options), {
		placeHolder: "Select a configuration option",
	});

	if (selectedOption) {
		await options[selectedOption]();
	}
}
