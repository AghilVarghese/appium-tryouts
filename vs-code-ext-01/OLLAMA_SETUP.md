# Using Ollama with Test Failure Analyzer

The Test Failure Analyzer extension now supports both OpenAI and Ollama for AI-powered test failure analysis.

## Prerequisites for Ollama

1. **Install Ollama**: Download and install Ollama from [ollama.ai](https://ollama.ai)

2. **Install Llama3**: Run this command in your terminal:
   ```bash
   ollama pull llama3
   ```

3. **Start Ollama Server**: Make sure Ollama is running:
   ```bash
   ollama serve
   ```
   By default, it runs on `http://localhost:11434`

## Configuration

### Option 1: Use VS Code Settings UI

1. Open VS Code Settings (`Cmd+,` or `Ctrl+,`)
2. Search for `testFailureAnalyzer`
3. Configure the following settings:
   - **Use Ollama**: Set to `true` to use Ollama instead of OpenAI
   - **Ollama Base URL**: Default is `http://localhost:11434`
   - **Ollama Model**: Default is `llama3` (you can use other models if installed)

### Option 2: Use Settings JSON

Add these settings to your VS Code settings.json:

```json
{
  "testFailureAnalyzer.useOllama": true,
  "testFailureAnalyzer.ollamaBaseUrl": "http://localhost:11434",
  "testFailureAnalyzer.ollamaModel": "llama3"
}
```

## Switching Between OpenAI and Ollama

You can easily switch between OpenAI and Ollama by changing the `useOllama` setting:

- **For OpenAI**: Set `testFailureAnalyzer.useOllama` to `false` and configure your OpenAI API key
- **For Ollama**: Set `testFailureAnalyzer.useOllama` to `true` and ensure Ollama is running

## Available Settings

| Setting | Description | Default Value |
|---------|-------------|---------------|
| `testFailureAnalyzer.useOllama` | Use Ollama instead of OpenAI | `false` |
| `testFailureAnalyzer.ollamaBaseUrl` | Ollama server URL | `http://localhost:11434` |
| `testFailureAnalyzer.ollamaModel` | Ollama model name | `llama3` |
| `testFailureAnalyzer.openaiApiKey` | OpenAI API key (when not using Ollama) | `""` |
| `testFailureAnalyzer.openaiModel` | OpenAI model (when not using Ollama) | `gpt-4o` |

## Supported Ollama Models

You can use any model installed in Ollama. Popular options include:
- `llama3` (recommended)
- `llama3:70b` (larger model, better quality)
- `codellama`
- `mistral`
- `gemma`

To install additional models:
```bash
ollama pull <model-name>
```

## Troubleshooting

### "Failed to connect to Ollama"
- Ensure Ollama is installed and running: `ollama serve`
- Check if the base URL is correct (default: `http://localhost:11434`)
- Verify the model is installed: `ollama list`

### "Model not found"
- Install the model: `ollama pull llama3`
- Check available models: `ollama list`
- Update the model name in settings

### Performance Considerations
- Ollama runs locally, so it may be slower than OpenAI depending on your hardware
- Larger models (like `llama3:70b`) provide better results but require more RAM
- For faster responses, use smaller models like `llama3:8b`

## Benefits of Using Ollama

1. **Privacy**: All processing happens locally
2. **Cost**: No API costs after initial setup
3. **Offline**: Works without internet connection
4. **Customization**: You can fine-tune models for your specific use cases

## Example Usage

1. Set `testFailureAnalyzer.useOllama` to `true`
2. Ensure Ollama is running with `llama3` model
3. Load your test results in the extension
4. Right-click on a failed step and select "Get AI Suggestion"
5. The extension will use Ollama locally to analyze the failure and provide suggestions
