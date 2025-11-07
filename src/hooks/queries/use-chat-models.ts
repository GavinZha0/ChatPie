import { appStore } from "@/app/store";
import { fetcher } from "lib/utils";
import useSWR, { SWRConfiguration } from "swr";

export const useChatModels = (options?: SWRConfiguration) => {
  return useSWR<
    {
      id: number;
      provider: string; // interface type key & icon key
      alias: string; // display name and grouping key
      hasAPIKey: boolean;
      models: {
        name: string;
        isToolCallUnsupported: boolean;
        isImageInputUnsupported: boolean;
        supportedFileMimeTypes: string[];
      }[];
    }[]
  >("/api/chat/models", fetcher, {
    dedupingInterval: 60_000 * 5,
    revalidateOnFocus: false,
    fallbackData: [],
    onSuccess: (data) => {
      const status = appStore.getState();
      if (!status.chatModel) {
        const firstProvider = data[0].provider;
        const model = data[0].models[0].name;
        appStore.setState({ chatModel: { provider: firstProvider, model } });
      }
    },
    ...options,
  });
};
