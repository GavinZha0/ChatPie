# Page Agent Tool

This directory contains Page Agent integration for ChatPie, allowing users to control web interfaces using natural language commands.

## Files Structure

- `types.ts` - TypeScript interfaces and types
- `index.ts` - Main tool definition and export
- `README.md` - This file

**Client Component:**
- `components/page-agent-tool-invocation.tsx` - UI component for tool execution

## Usage

Users can invoke Page Agent by typing `$` in chat input and selecting "Page Agent" from the tool list, then entering commands like:

- "Click login button"
- "Fill in email field with user@example.com"
- "Navigate to settings page"
- "Submit the form"

## Configuration

Page Agent now uses user's selected model configuration dynamically:

```typescript
// Configuration is fetched from user's current selection
{
  model: selectedModel.model,        // From user's dropdown selection
  baseURL: selectedProvider.baseUrl,    // From database provider config
  apiKey: selectedProvider.apiKey,      // From database provider config
  language: "en-US",                  // Default or user-specified
}
```

## Final Simplified Architecture

### Key Design Principles

1. **Server-side**: Tool gets user's selected model from global state and database
2. **Client-side**: Component uses configuration passed from backend
3. **Direct execution**: No intermediate layers or complex caching

### Execution Flow

1. User types `$` and selects "Page Agent"
2. Tool execution gets user's selected model from `appStore.getState().chatModel`
3. Database query fetches provider configuration for selected model
4. Backend passes complete configuration to client-side component
5. `PageAgentToolInvocation` directly uses passed configuration
6. Component executes Page Agent with user's selected model

### Key Components

- `page-agent/index.ts`: Tool definition with dynamic model fetching (45 lines)
- `page-agent-tool-invocation.tsx`: UI and execution with backend config (130 lines)
- `message-parts.tsx`: Integration with tool display system

## Dependencies

- `page-agent` npm package (installed ✅)
- Browser environment (required for DOM access)
- User's selected model configuration

## Integration Status

✅ Added to AppDefaultToolkit enum
✅ Added to DefaultToolName enum  
✅ Added to APP_DEFAULT_TOOL_KIT
✅ Added icon support (MousePointer icon)
✅ Type definitions complete
✅ Dynamic model fetching from user selection
✅ Database provider configuration integration
✅ UI integration with ToolMessagePart
✅ Dynamic imports for SSR compatibility

## Code Reduction

**Before**: 7 files, ~400+ lines of code
**After**: 3 files, ~175 lines of code

**Removed**:
- `config.ts` - No longer needed, config fetched dynamically
- `executor.ts` - No longer needed, execution moved to component
- Complex caching and environment detection
- Hard-coded configuration values

## Usage Flow

1. User types `$` and selects "Page Agent"
2. User enters natural language command
3. Tool fetches user's selected model from global state
4. Database provides provider configuration for selected model
5. Backend passes complete configuration to client-side
6. PageAgentToolInvocation renders with user's model config
7. User clicks "Execute" button
8. Component executes Page Agent with correct configuration
9. Results displayed in chat interface

## Configuration Flow

```
User Selection (Dropdown) → Global State → Tool Execution → Database Query → Provider Config → Client Execution
         ↓                    ↓           ↓              ↓              ↓              ↓
    "qwen3.5:9b" → appStore → pageAgentTool → providerRepo → {baseUrl, apiKey} → PageAgent
```

## Benefits of Final Approach

1. **Dynamic Configuration** - Always uses user's current selection
2. **Simplified Codebase** - 50% less code, easier maintenance
3. **Consistent Architecture** - Matches ChatPie's model management patterns
4. **Real-time Updates** - Model changes immediately affect tool execution
5. **Error Handling** - Clear validation for model and provider existence
6. **Security** - API keys handled server-side, passed to client securely
