import { JSONSchema7 } from "json-schema";
import { tool as createTool } from "ai";
import { jsonSchemaToZod } from "lib/json-schema-to-zod";

export const pythonExecutionSchema: JSONSchema7 = {
  type: "object",
  properties: {
    code: {
      type: "string",
      description: `Execute Python code in the user's browser via Pyodide.

Packages: Common packages (pandas, numpy, matplotlib, plotly) are automatically detected and loaded. No need to manually install.

Network access: use pyodide.http.open_url for HTTP/HTTPS, not urllib/request/requests. CORS must allow the app origin.
Example (CSV):
from pyodide.http import open_url
import pandas as pd
url = 'https://example.com/data.csv'
df = pd.read_csv(open_url(url))
print(df.head())

Matplotlib: Plots are automatically captured as base64 PNG images. Just use plt.show().
Example:
import matplotlib.pyplot as plt
import numpy as np
x = np.linspace(0, 2*np.pi, 100)
plt.plot(x, np.sin(x))
plt.title('Sine Wave')
plt.show()  # Automatically displays as image

Plotly (Recommended): Creates interactive charts with zoom, pan, and hover features. Use fig.show().
Example:
import plotly.graph_objects as go
import plotly.express as px
import numpy as np

# Using graph_objects
fig = go.Figure(data=go.Scatter(x=[1,2,3,4], y=[10,11,12,13]))
fig.update_layout(title='Interactive Line Chart')
fig.show()  # Automatically displays as interactive HTML

# Using express (simpler)
import pandas as pd
df = pd.DataFrame({'x': [1,2,3,4], 'y': [10,11,12,13]})
fig = px.line(df, x='x', y='y', title='Simple Line Chart')
fig.show()

Return values: DataFrames, Series, and NumPy arrays are automatically converted to JSON-serializable format. You can directly return pandas DataFrames without manual conversion.

Output capture:
pyodide.setStdout({
  batched: (output: string) => {
    const type = output.startsWith('data:image/png;base64') ? 'image' : 'data'
    logs.push({ type: 'log', args: [{ type, value: output }] })
  },
})
pyodide.setStderr({
  batched: (output: string) => {
    logs.push({ type: 'error', args: [{ type: 'data', value: output }] })
  },
})`,
    },
  },
  required: ["code"],
};

export const pythonExecutionTool = createTool({
  description:
    "Execute Python code in the user's browser via Pyodide. Supports interactive Plotly charts (recommended) and matplotlib. DataFrames/Series are auto-converted to JSON. Use pyodide.http.open_url for HTTP(S) downloads; CORS must allow the app origin.",
  inputSchema: jsonSchemaToZod(pythonExecutionSchema),
});
