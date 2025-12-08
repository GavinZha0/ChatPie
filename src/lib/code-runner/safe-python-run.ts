"use client";

import { safe } from "ts-safe";
import {
  CodeRunnerOptions,
  CodeRunnerResult,
  LogEntry,
} from "./code-runner.interface";

// Add security validations similar to JS

function validateCodeSafety(code: string): string | null {
  if (code.includes("os.system")) return "Forbidden: os.system";
  return null;
}

function normalizePythonCode(code: string): string {
  let s = code.replace(/^\uFEFF/, "");
  s = s.replace(/\r\n/g, "\n");
  const fenceStart = s.match(/^```[a-zA-Z0-9_\-]*\s*\n/);
  if (fenceStart) {
    s = s.slice(fenceStart[0].length);
    const idx = s.lastIndexOf("```");
    if (idx >= 0) s = s.slice(0, idx);
  }
  s = s.replace(/\t/g, "    ");
  s = s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n");
  const lines = s.split(/\n/);
  while (lines.length && /^\s*$/.test(lines[0])) lines.shift();
  while (lines.length && /^\s*$/.test(lines[lines.length - 1])) lines.pop();
  if (!lines.length) return "";
  const indents = lines
    .filter((l) => /\S/.test(l))
    .map((l) => {
      const m = l.match(/^[ ]+/);
      return m ? m[0].length : 0;
    });
  const minIndent = indents.length ? Math.min(...indents) : 0;
  if (minIndent > 0) {
    const prefix = " ".repeat(minIndent);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(prefix)) lines[i] = lines[i].slice(minIndent);
    }
  }
  return lines.join("\n");
}

// Output handlers from reference
export const OUTPUT_HANDLERS = {
  matplotlib: `
    import io
    import base64
    import matplotlib
    from matplotlib import pyplot as plt

    # IMPORTANT: Set backend BEFORE any pyplot operations to avoid GUI issues
    matplotlib.use('agg')
    plt.ioff()  # Turn off interactive mode

    def setup_matplotlib_output():
        def custom_show():
            fig = plt.gcf()
            if fig.get_size_inches().prod() * fig.dpi ** 2 > 25_000_000:
                print("Warning: Plot size too large, reducing quality")
                fig.set_dpi(100)

            png_buf = io.BytesIO()
            fig.savefig(png_buf, format='png', bbox_inches='tight')
            png_buf.seek(0)
            png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
            print(f'data:image/png;base64,{png_base64}')
            png_buf.close()

            plt.clf()
            plt.close(fig)

        plt.show = custom_show
  `,
  plotly: `
def setup_plotly_output():
    """Setup Plotly to output interactive HTML"""
    try:
        import plotly
        print(f'[Plotly] Plotly version: {plotly.__version__}')
        
        import plotly.graph_objects as go
        
        def custom_show(self, *args, **kwargs):
            """Custom show function that outputs HTML to stdout"""
            try:
                # Use to_html() method
                html = self.to_html(
                    include_plotlyjs='cdn',
                    full_html=False,
                    config={
                        'displayModeBar': True,
                        'displaylogo': False,
                        'responsive': True
                    }
                )
                
                print(f'[Plotly] HTML length: {len(html)}')
                print('<!--PLOTLY_START-->')
                print(html)
                print('<!--PLOTLY_END-->')
                print('[Plotly] Figure rendered successfully')
                
            except Exception as e:
                print(f'[Plotly] Error rendering figure: {str(e)}')
                import traceback
                traceback.print_exc()
        
        # Override the show method for all Figure instances
        go.Figure.show = custom_show
    except Exception as e:
        print(f'[Plotly] Failed to setup output handler: {str(e)}')
        import traceback
        traceback.print_exc()
  `,
  pandas: `
    import json
    try:
        import pandas as pd
        _pd_available = True
    except ImportError:
        _pd_available = False

    def _serialize_for_js(obj):
        """Convert Python objects to JSON-serializable format"""
        if not _pd_available:
            return obj
        
        # Handle pandas DataFrame
        if isinstance(obj, pd.DataFrame):
            try:
                # Convert to dict with records orientation for better readability
                return {
                    '__type__': 'DataFrame',
                    'data': json.loads(obj.to_json(orient='records', date_format='iso')),
                    'columns': obj.columns.tolist(),
                    'shape': obj.shape,
                    'dtypes': {col: str(dtype) for col, dtype in obj.dtypes.items()}
                }
            except Exception:
                # Fallback to string representation
                return {'__type__': 'DataFrame', 'repr': str(obj)}
        
        # Handle pandas Series
        if isinstance(obj, pd.Series):
            try:
                return {
                    '__type__': 'Series',
                    'data': json.loads(obj.to_json(date_format='iso')),
                    'name': obj.name,
                    'dtype': str(obj.dtype)
                }
            except Exception:
                return {'__type__': 'Series', 'repr': str(obj)}
        
        # Handle other common types
        if hasattr(obj, 'tolist'):
            # NumPy arrays and similar
            try:
                return obj.tolist()
            except Exception:
                pass
        
        return obj
  `,
  basic: ``,
};

async function ensurePyodideLoaded(): Promise<any> {
  if ((globalThis as any).loadPyodide) {
    return (globalThis as any).loadPyodide;
  }

  const isWorker = typeof (globalThis as any).importScripts !== "undefined";

  if (isWorker) {
    try {
      (globalThis as any).importScripts(
        "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js",
      );
      return (globalThis as any).loadPyodide;
    } catch {
      throw new Error("Failed to load Pyodide script in worker");
    }
  } else {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"]',
    );

    if (existingScript) {
      if ((globalThis as any).loadPyodide) {
        return (globalThis as any).loadPyodide;
      }
      await new Promise<void>((resolve, reject) => {
        existingScript.addEventListener("load", () => resolve(), {
          once: true,
        });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Failed to load Pyodide script")),
          { once: true },
        );
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("Failed to load Pyodide script"));
        document.head.appendChild(script);
      });
    }
  }

  return (globalThis as any).loadPyodide;
}

function detectRequiredHandlers(code: string): string[] {
  const handlers: string[] = ["basic"];

  // Detect matplotlib usage (various import patterns)
  const hasMatplotlib =
    code.includes("matplotlib") ||
    code.includes("plt.") ||
    code.includes("pyplot") ||
    /import\s+matplotlib/i.test(code) ||
    /from\s+matplotlib/i.test(code);

  if (hasMatplotlib) {
    handlers.push("matplotlib");
  }

  // Detect Plotly usage
  const hasPlotly =
    code.includes("plotly") ||
    code.includes("go.Figure") ||
    code.includes("px.") ||
    /import\s+plotly/i.test(code) ||
    /from\s+plotly/i.test(code);

  if (hasPlotly) {
    handlers.push("plotly");
  }

  return handlers;
}

export async function safePythonRun({
  code,
  timeout = 30000,
  onLog,
}: CodeRunnerOptions): Promise<CodeRunnerResult> {
  return safe(async () => {
    const startTime = Date.now();
    const logs: LogEntry[] = [];

    const securityError = validateCodeSafety(code);
    if (securityError) throw new Error(securityError);

    const normalizedCode = normalizePythonCode(code);

    const loadPyodide = await ensurePyodideLoaded();

    // Load Pyodide

    const pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
    });

    // Set up stdout capture
    let plotlyHtmlBuffer = "";
    let isCapturingPlotly = false;

    pyodide.setStdout({
      batched: (output: string) => {
        // Handle Plotly HTML markers
        if (output.trim() === "<!--PLOTLY_START-->") {
          isCapturingPlotly = true;
          plotlyHtmlBuffer = "";
          return;
        }

        if (output.trim() === "<!--PLOTLY_END-->") {
          isCapturingPlotly = false;
          console.log(
            `[Plotly] Finished capturing HTML, length: ${plotlyHtmlBuffer.length}`,
          );
          if (plotlyHtmlBuffer.trim()) {
            logs.push({
              type: "log",
              args: [{ type: "html", value: plotlyHtmlBuffer.trim() }],
            });
            onLog?.({
              type: "log",
              args: [{ type: "html", value: plotlyHtmlBuffer.trim() }],
            });
          } else {
          }
          plotlyHtmlBuffer = "";
          return;
        }

        if (isCapturingPlotly) {
          plotlyHtmlBuffer += output + "\n";
          return;
        }

        // Handle regular output
        const type = output.startsWith("data:image/png;base64")
          ? "image"
          : "data";
        logs.push({ type: "log", args: [{ type, value: output }] });
        onLog?.({ type: "log", args: [{ type, value: output }] });
      },
    });
    pyodide.setStderr({
      batched: (output: string) => {
        logs.push({ type: "error", args: [{ type: "data", value: output }] });
        onLog?.({ type: "error", args: [{ type: "data", value: output }] });
      },
    });

    // Load packages from imports
    await pyodide.loadPackagesFromImports(normalizedCode);

    // Detect and load required packages/handlers
    const requiredHandlers = detectRequiredHandlers(normalizedCode);

    // Explicitly load matplotlib if detected in code
    if (requiredHandlers.includes("matplotlib")) {
      try {
        await pyodide.loadPackage("matplotlib");
      } catch (error) {
        console.warn("Failed to load matplotlib package:", error);
      }
    }

    // Explicitly load Plotly if detected in code
    if (requiredHandlers.includes("plotly")) {
      try {
        // Plotly is not in Pyodide built-in packages, use micropip to install from PyPI
        await pyodide.loadPackage("micropip");
        const micropip = pyodide.pyimport("micropip");
        console.log("[Plotly] Installing plotly via micropip...");
        await micropip.install("plotly");
        console.log("[Plotly] Plotly installed successfully");
        micropip.destroy();
      } catch (error) {
        console.error("[Plotly] Failed to install plotly package:", error);
      }
    }

    // Setup output handlers
    for (const handler of requiredHandlers) {
      await pyodide.runPythonAsync(
        OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS],
      );
      if (handler === "matplotlib") {
        await pyodide.runPythonAsync("setup_matplotlib_output()");
      }
      if (handler === "plotly") {
        await pyodide.runPythonAsync("setup_plotly_output()");
      }
    }

    // Always load pandas serialization handler
    await pyodide.runPythonAsync(OUTPUT_HANDLERS.pandas);

    // Execute code with timeout
    const execution = pyodide.runPythonAsync(normalizedCode);
    const timer = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeout),
    );
    const returnValue = await Promise.race([execution, timer]);
    let clonedResult = returnValue as any;

    // Serialize result for safe JS transfer
    try {
      // Try to serialize using our custom handler if result is a Python object
      if (clonedResult && typeof clonedResult === "object") {
        // Store the result temporarily in Python's globals
        pyodide.globals.set("_temp_result", clonedResult);

        try {
          const serialized = await pyodide.runPythonAsync(
            `_serialize_for_js(_temp_result)`,
          );

          // Clean up temporary variable
          pyodide.runPython("del _temp_result");

          if (serialized !== undefined && serialized !== clonedResult) {
            // Successfully serialized to a different format
            const isObject = serialized && typeof serialized === "object";
            const hasToJs =
              isObject && typeof (serialized as any).toJs === "function";

            if (hasToJs) {
              const jsVal = (serialized as any).toJs({
                dict_converter: Object.fromEntries,
              });
              try {
                if (typeof (serialized as any).destroy === "function") {
                  (serialized as any).destroy();
                }
              } catch {}
              clonedResult =
                jsVal instanceof Map
                  ? Object.fromEntries(jsVal as Map<any, any>)
                  : jsVal;
            } else {
              clonedResult = serialized;
            }

            // Destroy original Python object
            try {
              if (typeof (returnValue as any).destroy === "function") {
                (returnValue as any).destroy();
              }
            } catch {}
          } else {
            // No special serialization needed, use standard conversion
            const hasToJs = typeof (clonedResult as any).toJs === "function";
            if (hasToJs) {
              const jsVal = (clonedResult as any).toJs({
                dict_converter: Object.fromEntries,
              });
              try {
                if (typeof (clonedResult as any).destroy === "function") {
                  (clonedResult as any).destroy();
                }
              } catch {}
              clonedResult =
                jsVal instanceof Map
                  ? Object.fromEntries(jsVal as Map<any, any>)
                  : jsVal;
            }
          }
        } catch (innerError) {
          // Cleanup on error
          try {
            pyodide.runPython("del _temp_result");
          } catch {}
          throw innerError;
        }
      }
    } catch (_serializeError) {
      // If serialization fails, try basic conversion as fallback
      try {
        const isObject = clonedResult && typeof clonedResult === "object";
        const hasToJs =
          isObject && typeof (clonedResult as any).toJs === "function";
        if (hasToJs) {
          const jsVal = (clonedResult as any).toJs({
            dict_converter: Object.fromEntries,
          });
          try {
            if (typeof (clonedResult as any).destroy === "function") {
              (clonedResult as any).destroy();
            }
          } catch {}
          clonedResult =
            jsVal instanceof Map
              ? Object.fromEntries(jsVal as Map<any, any>)
              : jsVal;
        }
      } catch {}
    }

    return {
      success: true,
      logs,
      executionTimeMs: Date.now() - startTime,
      result: clonedResult,
    } as CodeRunnerResult;
  })
    .ifFail((err) => ({
      success: false,
      error: err.message,
      logs: [],
      solution: "Python execution failed. Check syntax, imports, or timeout.",
    }))
    .unwrap();
}
