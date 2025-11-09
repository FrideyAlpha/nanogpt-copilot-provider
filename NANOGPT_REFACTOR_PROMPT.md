# Prompt Engineer: Refactor Synthetic Provider ke NanoGPT Provider

## Objective
Refactor entire VS Code extension project dari Synthetic provider menjadi NanoGPT provider dengan mengintegrasikan semua fitur khusus NanoGPT dan mempertahankan functionality yang ada.

## Task Overview
Transformasi komprehensif meliputi perubahan API integration, penambahan fitur-fitur NanoGPT (reasoning, memory, search, BYOK), update UI/UX, dokumentasi, dan testing. Semua referensi "Synthetic" harus diganti menjadi "NanoGPT" dengan konfigurasi yang sesuai.

## Reasoning Process
**Critical Analysis**: Setiap perubahan harus mempertahankan compatibility dengan VS Code Language Model Chat API sambil mengintegrasikan fitur-fitur advanced NanoGPT. Reasoning diperlukan untuk:
- Memetakan Synthetic API structure ke NanoGPT API
- Mendesain UI untuk konfigurasi fitur-fitur baru NanoGPT
- Memastikan backward compatibility untuk existing users
- Mengoptimalkan user experience untuk fitur-fitur advanced

## Implementation Steps

### Phase 1: Core API Integration
**File: `package.json`**
- Ubah name dari "synthetic-copilot-provider" ke "nanogpt-copilot-provider"
- Ubah publisher dari "SyntheticLab" ke "NanoGPT"
- Ubah displayName dari "Synthetic Provider for GitHub Copilot" ke "NanoGPT Provider for GitHub Copilot"
- Ubah description sesuai
- Update homepage dari "https://synthetic.new" ke "https://nano-gpt.com"
- Update repository URL
- Update icon path jika diperlukan
- Ubah vendor dari "synthetic" ke "nanogpt" di languageModelChatProviders
- Update command names dari "synthetic.*" ke "nanogpt.*"
- Update configuration properties dari "synthetic.*" ke "nanogpt.*"

**File: `src/extension.ts`**
- Ubah import dari SyntheticChatModelProvider ke NanoGPTChatModelProvider
- Ubah class instantiation
- Update vendor registration dari "synthetic" ke "nanogpt"
- Update command registrations dari "synthetic.*" ke "nanogpt.*"
- Update secret storage key dari "synthetic.apiKey" ke "nanogpt.apiKey"
- Update user agent dari "synthetic-vscode-chat" ke "nanogpt-vscode-chat"
- Update API key prompts dari "Synthetic API Key" ke "NanoGPT API Key"

**File: `src/syntheticModels.ts` → `src/nanogptModels.ts`**
- Rename file dan class dari SyntheticModelsService ke NanoGPTModelsService
- Update BASE_URL dari "https://api.synthetic.new/openai/v1" ke "https://nano-gpt.com/api"
- Update models endpoint dari "https://api.synthetic.new/openai/v1/models" ke "https://nano-gpt.com/api/v1/models"
- Hapus dependency ke models.dev/api.json (NanoGPT tidak menggunakan ini)
- Update API key storage dari "synthetic.apiKey" ke "nanogpt.apiKey"
- Update DEFAULT_MODEL_DETAILS tooltip dari "Synthetic" ke "NanoGPT"
- Update family dari "synthetic" ke "nanogpt"
- Update detail dari "Synthetic.new" ke "NanoGPT.com"

### Phase 2: Feature Integration
**File: `src/types.ts`**
- Update SyntheticModelDetailsSchema untuk mencakup NanoGPT features
- Tambahkan reasoning support fields
- Tambahkan memory configuration fields
- Tambahkan search configuration fields
- Tambahkan BYOK configuration fields
- Update semua references dari Synthetic ke NanoGPT

**File: `src/utils.ts`**
- Update convertRequestToOpenAI untuk mendukung NanoGPT reasoning
- Tambahkan reasoning parameter handling
- Tambahkan memory configuration support
- Tambahkan search suffix handling
- Tambahkan BYOK configuration support
- Update provideTokenCount jika diperlukan

**File: `src/provider.ts`**
- Rename class dari SyntheticChatModelProvider ke NanoGPTChatModelProvider
- Update import dari SyntheticModelsService ke NanoGPTModelsService
- Integrasikan reasoning support dalam chat requests
- Tambahkan memory configuration handling
- Tambahkan search functionality
- Tambahkan BYOK support
- Update error handling untuk NanoGPT-specific errors

### Phase 3: Configuration Enhancement
**File: `src/config.ts`**
- Update getModelTemperature untuk configuration "nanogpt.modelTemperatures"
- Update setModelTemperature untuk configuration "nanogpt.modelTemperatures"
- Update showTemperatureConfigUI untuk menggunakan NanoGPTModelsService
- Tambahkan functions untuk configure reasoning settings
- Tambahkan functions untuk configure memory settings
- Tambahkan functions untuk configure search settings
- Tambahkan functions untuk configure BYOK settings
- Update semua prompts dan messages

### Phase 4: UI/UX Enhancement
**File: `src/config.ts` (continued)**
- Extend showTemperatureConfigUI untuk include NanoGPT features
- Tambahkan UI untuk reasoning configuration (effort levels: low, medium, high)
- Tambahkan UI untuk memory configuration (days: 1-365)
- Tambahkan UI untuk search configuration (standard vs deep)
- Tambahkan UI untuk BYOK configuration (provider selection)
- Update model selection UI untuk menampilkan suffixes info

**New File: `src/nanogptFeatures.ts`**
- Buat UI components untuk konfigurasi fitur-fitur NanoGPT
- Reasoning configuration panel
- Memory configuration panel
- Search configuration panel
- BYOK configuration panel
- Model suffixes information display

### Phase 5: Documentation Update
**File: `README.md`**
- Update title dari Synthetic ke NanoGPT
- Update description dan overview
- Update quick start instructions
- Update screenshots references (buat yang baru jika diperlukan)
- Update development section
- Update installation instructions
- Update troubleshooting section
- Tambahkan section untuk NanoGPT-specific features
- Update links dan references

**File: `AGENTS.md`**
- Update project overview
- Update technology stack description
- Update API integration details
- Update development environment setup
- Update troubleshooting section
- Update pull request guidelines

**Assets Update**
- Ganti logo dari Synthetic ke NanoGPT branding
- Update screenshots dengan UI baru
- Update documentation images

### Phase 6: Testing Update
**File: `src/test/config.test.ts`**
- Update test cases untuk nanogpt configuration
- Tambahkan tests untuk reasoning configuration
- Tambahkan tests untuk memory configuration
- Tambahkan tests untuk search configuration
- Tambahkan tests untuk BYOK configuration

**File: `src/test/provider.test.ts`**
- Update test cases untuk NanoGPT provider
- Tambahkan tests untuk reasoning functionality
- Tambahkan tests untuk memory functionality
- Tambahkan tests untuk search functionality
- Update message conversion tests

**File: `src/test/syntheticModels.test.ts` → `src/test/nanogptModels.test.ts`**
- Rename file dan update all test cases
- Update API endpoint tests
- Update model fetching tests
- Update authentication tests
- Tambahkan tests untuk NanoGPT-specific features

**File: `src/test/utils.test.ts`**
- Update test cases untuk NanoGPT utilities
- Tambahkan tests untuk reasoning conversion
- Tambahkan tests untuk memory handling
- Tambahkan tests untuk search suffix handling

**File: `src/test/thinkParser.test.ts`**
- Update untuk NanoGPT reasoning format
- Update parsing logic jika diperlukan

**File: `src/test/toolConversion.test.ts`**
- Update untuk compatibility dengan NanoGPT

## Output Format Requirements

### Code Changes
- Semua file harus menggunakan TypeScript strict mode
- Maintain existing ESLint rules dan Prettier formatting
- Update semua imports dan exports sesuai naming changes
- Ensure backward compatibility где возможно

### Configuration Schema
```json
{
  "nanogpt": {
    "modelTemperatures": {
      "gpt-4o": 0.7,
      "gpt-4o-mini": 0.5
    },
    "reasoning": {
      "enabled": true,
      "defaultEffort": "medium"
    },
    "memory": {
      "enabled": true,
      "defaultDays": 30
    },
    "search": {
      "enabled": true,
      "defaultMode": "standard"
    },
    "byok": {
      "enabled": false,
      "defaultProvider": "openai"
    }
  }
}
```

### API Integration Examples
```typescript
// Reasoning Configuration
await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  reasoning: { enabled: true, effort: 'medium' }
});

// Memory Configuration
await client.chat.completions.create({
  model: 'gpt-4o:memory-30',
  messages: [...],
  headers: {
    memory: 'true',
    memory_expiration_days: '30'
  }
});

// Search Configuration
await client.chat.completions.create({
  model: 'gpt-4o:online',
  messages: [...]
});

// BYOK Configuration
await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  byok: { enabled: true, provider: 'openai' },
  headers: { 'x-use-byok': 'true' }
});
```

## Examples

### Before (Synthetic)
```typescript
const provider = new SyntheticChatModelProvider(secrets, userAgent);
vscode.lm.registerLanguageModelChatProvider("synthetic", provider);
```

### After (NanoGPT)
```typescript
const provider = new NanoGPTChatModelProvider(secrets, userAgent);
vscode.lm.registerLanguageModelChatProvider("nanogpt", provider);
```

### Configuration UI Example
```
┌─ NanoGPT Model Configuration ─┐
│ Model: gpt-4o                 │
│ Temperature: [0.7]            │
│                               │
│ ┌─ Reasoning ─────────────┐   │
│ │ Enabled: [✓]            │   │
│ │ Effort: (○) Low         │   │
│ │        (●) Medium       │   │
│ │        ( ) High         │   │
│ └─────────────────────────┘   │
│                               │
│ ┌─ Memory ─────────────────┐  │
│ │ Enabled: [✓]             │  │
│ │ Duration: [30] days      │  │
│ └─────────────────────────┘  │
│                               │
│ ┌─ Search ─────────────────┐  │
│ │ Enabled: [✓]             │  │
│ │ Mode: (●) Standard       │  │
│ │       ( ) Deep           │  │
│ └─────────────────────────┘  │
│                               │
│      [Save] [Cancel]          │
└───────────────────────────────┘
```

## Notes

### Critical Considerations
1. **Backward Compatibility**: Existing Synthetic users harus bisa migrate dengan smooth
2. **API Key Migration**: Provide migration path dari synthetic.apiKey ke nanogpt.apiKey
3. **Model Compatibility**: Ensure existing model selections tetap work jika possible
4. **Error Handling**: Implement proper error handling untuk NanoGPT-specific errors
5. **Performance**: Maintain atau improve performance dibanding Synthetic version

### Edge Cases
- Handle missing API keys gracefully
- Handle API rate limits dengan proper retry logic
- Handle model unavailability dengan fallback options
- Handle network failures dengan user-friendly messages
- Handle configuration validation errors

### Security Considerations
- Secure API key storage di VS Code SecretStorage
- Validate all user inputs untuk configuration
- Sanitize model names dan parameters
- Handle BYOK keys dengan extra security measures

### Testing Strategy
- Unit tests untuk semua core functions
- Integration tests untuk API calls
- UI tests untuk configuration panels
- End-to-end tests untuk complete workflows
- Performance tests untuk streaming responses

### Deployment Checklist
- [ ] Update version number di package.json
- [ ] Test extension installation process
- [ ] Verify all commands work correctly
- [ ] Test configuration persistence
- [ ] Verify API integration
- [ ] Test error scenarios
- [ ] Update marketplace listing
- [ ] Create migration guide untuk existing users

## Conclusion
Transformasi ini akan menghasilkan VS Code extension yang fully-featured untuk NanoGPT dengan semua advanced features terintegrasi seamlessly, sambil maintaining excellent user experience dan backward compatibility где possible.