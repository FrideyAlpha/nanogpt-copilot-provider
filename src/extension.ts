import * as vscode from "vscode";
import { NanoGPTChatModelProvider } from "./provider";
import { showNanoGPTConfigUI } from "./config";

export function activate(context: vscode.ExtensionContext) {
	// Build a descriptive User-Agent to help quantify API usage
	const ext = vscode.extensions.getExtension("NanoGPT.nanogpt-copilot-provider");
	const extVersion = ext?.packageJSON?.version ?? "unknown";
	const vscodeVersion = vscode.version;
	// Keep UA minimal: only extension version and VS Code version
	const ua = `nanogpt-copilot-provider/${extVersion} VSCode/${vscodeVersion}`;

	const provider = new NanoGPTChatModelProvider(context.secrets, ua);
	// Register the NanoGPT provider under the vendor id used in package.json
	vscode.lm.registerLanguageModelChatProvider("nanogpt", provider);

	// Management command to configure API key and other settings
	context.subscriptions.push(
		vscode.commands.registerCommand("nanogpt.manage", async () => {
			const options: Record<string, () => Promise<void>> = {
				"Set API Key": async () => {
					const existing = await context.secrets.get("nanogpt.apiKey");
					const apiKey = await vscode.window.showInputBox({
						title: "NanoGPT API Key",
						prompt: existing ? "Update your NanoGPT API key" : "Enter your NanoGPT API key",
						ignoreFocusOut: true,
						password: true,
						value: existing ?? "",
					});
					if (apiKey === undefined) {
						return; // user canceled
					}
					if (!apiKey.trim()) {
						await context.secrets.delete("nanogpt.apiKey");
						vscode.window.showInformationMessage("NanoGPT API key cleared.");
						return;
					}
					await context.secrets.store("nanogpt.apiKey", apiKey.trim());
					vscode.window.showInformationMessage("NanoGPT API key saved.");
				},
				"Configure Provider": () => showNanoGPTConfigUI(context.secrets),
			};

			const selectedOption = await vscode.window.showQuickPick(Object.keys(options), {
				placeHolder: "Select an action",
			});

			if (selectedOption) {
				await options[selectedOption]();
			}
		})
	);
}

export function deactivate() { }
