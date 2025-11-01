import { customModelProvider } from "lib/ai/models";

export const GET = async () => {
  const modelsInfo = await customModelProvider.getModelsInfo();
  return Response.json(
    modelsInfo.sort((a, b) => {
      if (a.hasAPIKey && !b.hasAPIKey) return -1;
      if (!a.hasAPIKey && b.hasAPIKey) return 1;
      return 0;
    }),
  );
};
