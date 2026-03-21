import { describe, expect, it } from "vitest";
import {
  DefaultToolName,
  getBuiltinToolInfo,
  getAllBuiltinTools,
  getBuiltinToolsByCategory,
  getBuiltinToolCategories,
  getToolkitInfo,
  getAllToolkitInfos,
} from "./index";

describe("Tool Registry", () => {
  describe("Builtin Tools", () => {
    it("should return correct tool info for CreatePieChart", () => {
      const toolInfo = getBuiltinToolInfo(DefaultToolName.CreatePieChart);

      expect(toolInfo.name).toBe(DefaultToolName.CreatePieChart);
      expect(toolInfo.label).toBe("pie-chart");
      expect(toolInfo.description).toBe("Create a pie chart");
      expect(toolInfo.category).toBe("visualization");
      expect(toolInfo.color).toBe("blue-500");
    });

    it("should return all builtin tools", () => {
      const allTools = getAllBuiltinTools();

      expect(allTools).toHaveLength(10);
      expect(allTools.map((tool) => tool.name)).toContain(
        DefaultToolName.CreatePieChart,
      );
      expect(allTools.map((tool) => tool.name)).toContain(
        DefaultToolName.WebSearch,
      );
      expect(allTools.map((tool) => tool.name)).toContain(DefaultToolName.Http);
    });

    it("should filter tools by category", () => {
      const visualizationTools = getBuiltinToolsByCategory("visualization");

      expect(visualizationTools).toHaveLength(4);
      expect(visualizationTools.map((tool) => tool.name)).toContain(
        DefaultToolName.CreatePieChart,
      );
      expect(visualizationTools.map((tool) => tool.name)).toContain(
        DefaultToolName.CreateBarChart,
      );
      expect(visualizationTools.map((tool) => tool.name)).toContain(
        DefaultToolName.CreateLineChart,
      );
      expect(visualizationTools.map((tool) => tool.name)).toContain(
        DefaultToolName.CreateTable,
      );
    });

    it("should return all categories", () => {
      const categories = getBuiltinToolCategories();

      expect(categories).toEqual([
        "visualization",
        "web",
        "code",
        "http",
        "page-agent",
      ]);
    });
  });

  describe("Toolkit Configuration", () => {
    it("should return correct toolkit info", () => {
      const toolkitInfo = getToolkitInfo("visualization" as any);

      expect(toolkitInfo.id).toBe("visualization");
      expect(toolkitInfo.label).toBe("visualization");
      expect(toolkitInfo.icon).toBeDefined();
    });

    it("should return all toolkit infos", () => {
      const allToolkitInfos = getAllToolkitInfos();

      expect(allToolkitInfos).toHaveLength(5);
      expect(allToolkitInfos.map((info) => info.id)).toContain("visualization");
      expect(allToolkitInfos.map((info) => info.id)).toContain("webSearch");
      expect(allToolkitInfos.map((info) => info.id)).toContain("code");
      expect(allToolkitInfos.map((info) => info.id)).toContain("http");
      expect(allToolkitInfos.map((info) => info.id)).toContain("pageAgent");
    });
  });
});
