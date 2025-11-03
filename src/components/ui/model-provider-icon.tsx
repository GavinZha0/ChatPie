import { ProviderIcon, Dify } from "@lobehub/icons";

export const PROVIDER_ICONS = {
  dify: Dify,
} as const;

interface ModelProviderIconProps {
  provider: string | undefined;
  colorful?: boolean;
  size?: number;
  className?: string;
}

export const ModelProviderIcon = ({
  provider,
  colorful = false,
  size = 24,
  className,
}: ModelProviderIconProps) => {
  const IconComponent = PROVIDER_ICONS[provider as keyof typeof PROVIDER_ICONS];
  if (IconComponent) {
    return colorful ? (
      <IconComponent.Color size={size} className={className} />
    ) : (
      <IconComponent size={size} className={className} />
    );
  }

  return colorful ? (
    <ProviderIcon
      provider={provider}
      size={size}
      type="color"
      className={className}
    />
  ) : (
    <ProviderIcon provider={provider} size={size} className={className} />
  );
};
