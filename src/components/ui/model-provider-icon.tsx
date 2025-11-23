import { ProviderIcon, Dify, Exa } from "@lobehub/icons";

export const PROVIDER_ICONS = {
  dify: Dify,
  exa: Exa,
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

  return (
    <div className={className}>
      {colorful ? (
        <ProviderIcon provider={provider} size={size} type="color" />
      ) : (
        <ProviderIcon provider={provider} size={size} />
      )}
    </div>
  );
};
