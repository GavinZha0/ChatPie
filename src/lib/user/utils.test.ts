import { describe, it, expect } from "vitest";
import { USER_ROLES } from "app-types/roles";
import { getUserAvatar, getIsUserAdmin } from "./utils";
import { getEmojiUrl } from "lib/emoji";

describe("User Utils", () => {
  describe("getUserAvatar - Avatar Selection Logic", () => {
    it("should prioritize user image over default", () => {
      const result = getUserAvatar({ image: "https://example.com/avatar.jpg" });
      expect(result).toBe("https://example.com/avatar.jpg");
    });

    it("should fall back to default avatar when no user image", () => {
      expect(getUserAvatar({ image: null })).toBe("/image/avatar/avatar01.png");
      expect(getUserAvatar({})).toBe("/image/avatar/avatar01.png");
      expect(getUserAvatar({ image: "" })).toBe("/image/avatar/avatar01.png");
    });

    it("should resolve unified emoji codes to emoji CDN", () => {
      const unified = "1f600";
      const expectedUrl = getEmojiUrl(unified);

      expect(getUserAvatar({ image: unified })).toBe(expectedUrl);
    });
  });

  describe("getIsUserAdmin - Role Parsing Logic", () => {
    it("should detect admin role in single role", () => {
      expect(getIsUserAdmin({ role: USER_ROLES.ADMIN })).toBe(true);
      expect(getIsUserAdmin({ role: USER_ROLES.USER })).toBe(false);
      expect(getIsUserAdmin({ role: USER_ROLES.EDITOR })).toBe(false);
    });

    it("should detect admin role in comma-separated roles", () => {
      expect(
        getIsUserAdmin({ role: `${USER_ROLES.USER},${USER_ROLES.ADMIN}` }),
      ).toBe(true);
      expect(
        getIsUserAdmin({ role: `${USER_ROLES.ADMIN},${USER_ROLES.EDITOR}` }),
      ).toBe(true);
      expect(
        getIsUserAdmin({ role: `${USER_ROLES.USER},${USER_ROLES.EDITOR}` }),
      ).toBe(false);
    });

    it("should handle edge cases gracefully", () => {
      expect(getIsUserAdmin({ role: null })).toBe(false);
      expect(getIsUserAdmin({})).toBe(false);
      expect(getIsUserAdmin({ role: "" })).toBe(false);
    });

    it("should require exact string match (case sensitive)", () => {
      expect(getIsUserAdmin({ role: "ADMIN" })).toBe(false); // wrong case
      expect(getIsUserAdmin({ role: " admin " })).toBe(false); // whitespace
    });
    it("should handle undefined user", () => {
      expect(getIsUserAdmin(undefined)).toBe(false);
    });
  });
});
