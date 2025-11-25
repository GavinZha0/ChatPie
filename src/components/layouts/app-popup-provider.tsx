"use client";

import dynamic from "next/dynamic";

const KeyboardShortcutsPopup = dynamic(
  () =>
    import("@/components/keyboard-shortcuts-popup").then(
      (mod) => mod.KeyboardShortcutsPopup,
    ),
  {
    ssr: false,
  },
);

const ChatPreferencesPopup = dynamic(
  () =>
    import("@/components/preference/chat-preferences-popup").then(
      (mod) => mod.ChatPreferencesPopup,
    ),
  {
    ssr: false,
  },
);

const ChatBotVoice = dynamic(
  () => import("@/components/chat-bot-voice").then((mod) => mod.ChatBotVoice),
  {
    ssr: false,
  },
);

const UserSettingsPopup = dynamic(
  () =>
    import("@/components/user/user-detail/user-settings-popup").then(
      (mod) => mod.UserSettingsPopup,
    ),
  {
    ssr: false,
  },
);

export function AppPopupProvider({
  userSettingsComponent,
}: {
  userSettingsComponent: React.ReactNode;
}) {
  return (
    <>
      <KeyboardShortcutsPopup />
      <ChatPreferencesPopup />
      <UserSettingsPopup userSettingsComponent={userSettingsComponent} />
      <ChatBotVoice />
    </>
  );
}
