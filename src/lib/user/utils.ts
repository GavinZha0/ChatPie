import { USER_ROLES } from "app-types/roles";
import { getEmojiUrl } from "lib/emoji";

const EMOJI_UNIFIED_REGEX = /^[\da-fA-F]{1,8}(?:-[\da-fA-F]{1,8})*$/;

export const getUserAvatar = (user: { image?: string | null }): string => {
  const image = user.image?.trim();

  if (image) {
    if (EMOJI_UNIFIED_REGEX.test(image)) {
      return getEmojiUrl(image);
    }
    return image;
  }

  return "/image/avatar/avatar01.png";
};

export const getIsUserAdmin = (user?: { role?: string | null }): boolean => {
  return user?.role?.split(",").includes(USER_ROLES.ADMIN) || false;
};
