import {
  FilePart,
  ImagePart,
  ModelMessage,
  ToolResultPart,
  tool as createTool,
} from "ai";
import {
  generateImageWithNanoBanana,
  generateImageWithOpenAI,
} from "lib/ai/image/generate-image";
import { serverFileStorage } from "lib/file-storage";

import z from "zod";
import { ImageToolName } from "..";
import logger from "logger";
// removed openai specific imports with old tool implementation
import { toAny } from "lib/utils";

export type ImageToolResult = {
  images: {
    url: string;
    mimeType?: string;
  }[];
  mode?: "create" | "edit" | "composite";
  guide?: string;
  model: string;
};

export const nanoBananaTool = createTool({
  name: ImageToolName,
  description: `Generate, edit, or composite images based on the conversation context. This tool automatically analyzes recent messages to create images without requiring explicit input parameters. It includes all user-uploaded images from the recent conversation and only the most recent AI-generated image to avoid confusion. Use the 'mode' parameter to specify the operation type: 'create' for new images, 'edit' for modifying existing images, or 'composite' for combining multiple images. Use this when the user requests image creation, modification, or visual content generation.`,
  inputSchema: z.object({
    mode: z
      .enum(["create", "edit", "composite"])
      .optional()
      .default("create")
      .describe(
        "Image generation mode: 'create' for new images, 'edit' for modifying existing images, 'composite' for combining multiple images",
      ),
  }),
  execute: async ({ mode }, { messages, abortSignal }) => {
    try {
      const { latestMessages } = buildImageContext(
        messages || [],
        "file",
        "assistant",
      );

      const images = await generateImageWithNanoBanana({
        prompt: "",
        abortSignal,
        messages: latestMessages,
      });

      const resultImages = await Promise.all(
        (images.images || []).map(async (image) => {
          try {
            const uploadedImage = await serverFileStorage.upload(
              Buffer.from(image.base64, "base64"),
              { contentType: image.mimeType },
            );
            return { url: uploadedImage.sourceUrl, mimeType: image.mimeType };
          } catch (e) {
            logger.error(e);
            logger.info(`upload image failed. using base64`);
            const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
            return { url: dataUrl, mimeType: image.mimeType };
          }
        }),
      );

      return {
        images: resultImages,
        mode,
        model: "gemini-2.5-flash-image",
        guide:
          resultImages.length > 0
            ? "The image has been successfully generated and is now displayed above. If you need any edits, modifications, or adjustments to the image, please let me know."
            : "I apologize, but the image generation was not successful. To help me create a better image for you, could you please provide more specific details about what you'd like to see? For example:\n\n• What style are you looking for? (realistic, cartoon, abstract, etc.)\n• What colors or mood should the image have?\n• Are there any specific objects, people, or scenes you want included?\n• What size or format would work best for your needs?\n\nPlease share these details and I'll try generating the image again with your specifications.",
      };
    } catch (e) {
      logger.error(e);
      throw e;
    }
  },
});

export const openaiImageAdapterTool = createTool({
  name: ImageToolName,
  description: `Generate, edit, or composite images based on the conversation context. This tool automatically analyzes recent messages to create images without requiring explicit input parameters. It includes all user-uploaded images from the recent conversation and only the most recent AI-generated image to avoid confusion. Use the 'mode' parameter to specify the operation type: 'create' for new images, 'edit' for modifying existing images, or 'composite' for combining multiple images. Use this when the user requests image creation, modification, or visual content generation.`,
  inputSchema: z.object({
    mode: z
      .enum(["create", "edit", "composite"])
      .optional()
      .default("create")
      .describe(
        "Image generation mode: 'create' for new images, 'edit' for modifying existing images, 'composite' for combining multiple images",
      ),
  }),
  execute: async ({ mode }, { messages, abortSignal }) => {
    try {
      const { prompt } = buildImageContext(messages || [], "image", "user");

      if (!prompt || !prompt.trim()) {
        return {
          images: [],
          mode,
          model: "gpt-image-1-mini",
          guide:
            "I apologize, but the image generation was not successful. To help me create a better image for you, could you please provide more specific details about what you'd like to see? For example:\n\n• What style are you looking for? (realistic, cartoon, abstract, etc.)\n• What colors or mood should the image have?\n• Are there any specific objects, people, or scenes you want included?\n• What size or format would work best for your needs?\n\nPlease share these details and I'll try generating the image again with your specifications.",
        };
      }

      const images = await generateImageWithOpenAI({
        prompt,
        abortSignal,
        model: { provider: "openai", model: "gpt-image-1-mini" },
      });

      const resultImages = await Promise.all(
        (images.images || []).map(async (image) => {
          try {
            const uploadedImage = await serverFileStorage.upload(
              Buffer.from(image.base64, "base64"),
              { contentType: image.mimeType },
            );
            return { url: uploadedImage.sourceUrl, mimeType: image.mimeType };
          } catch (e) {
            logger.error(e);
            logger.info(`upload image failed. using base64`);
            const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
            return { url: dataUrl, mimeType: image.mimeType };
          }
        }),
      );

      return {
        images: resultImages,
        mode,
        model: "gpt-image-1-mini",
        guide:
          resultImages.length > 0
            ? "The image has been successfully generated and is now displayed above. If you need any edits, modifications, or adjustments to the image, please let me know."
            : "I apologize, but the image generation was not successful. To help me create a better image for you, could you please provide more specific details about what you'd like to see? For example:\n\n• What style are you looking for? (realistic, cartoon, abstract, etc.)\n• What colors or mood should the image have?\n• Are there any specific objects, people, or scenes you want included?\n• What size or format would work best for your needs?\n\nPlease share these details and I'll try generating the image again with your specifications.",
      };
    } catch (e) {
      logger.error(e);
      throw e;
    }
  },
});

function buildImageContext(
  messages: ModelMessage[],
  partKind: "file" | "image",
  injectRole: "user" | "assistant",
) {
  let hasFoundImage = false;
  const latestMessages = (messages || [])
    .slice(-6)
    .reverse()
    .map((m) => {
      if (m.role != "tool") return m;
      if (hasFoundImage) return m;
      const parts =
        partKind === "file"
          ? m.content.flatMap(convertToImageToolPartToFilePart)
          : m.content.flatMap(convertToImageToolPartToImagePart);
      if (parts.length === 0) return m;
      hasFoundImage = true;
      return { ...m, role: injectRole, content: parts } as ModelMessage;
    })
    .filter((v) => Boolean(v?.content?.length))
    .reverse() as ModelMessage[];

  const prompt = latestMessages
    .flatMap((m) =>
      Array.isArray(m.content)
        ? m.content
            .filter((p: any) => p?.type === "text")
            .map((p: any) => (p?.text || "").trim())
        : typeof m.content === "string"
          ? [m.content]
          : [],
    )
    .filter((t) => t.length > 0)
    .slice(-4)
    .join("\n");

  return { latestMessages, prompt };
}

function convertToImageToolPartToImagePart(part: ToolResultPart): ImagePart[] {
  if (part.toolName !== ImageToolName) return [];
  if (!toAny(part).output?.value?.images?.length) return [];
  const result = part.output.value as ImageToolResult;
  return result.images.map((image) => ({
    type: "image",
    image: image.url,
    mediaType: image.mimeType,
  }));
}

function convertToImageToolPartToFilePart(part: ToolResultPart): FilePart[] {
  if (part.toolName !== ImageToolName) return [];
  if (!toAny(part).output?.value?.images?.length) return [];
  const result = part.output.value as ImageToolResult;
  return result.images.map((image) => ({
    type: "file",
    mediaType: image.mimeType!,
    data: image.url,
  }));
}
