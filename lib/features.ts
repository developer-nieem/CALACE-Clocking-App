export const FEATURE_FLAGS = [
  "ai_scheduler",
  "chat",
  "calendar_sync",
  "automations",
  "facility_billing",
  "forms",
  "knowledge_base",
  "pwa",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export type FeatureFlagMap = Partial<Record<FeatureFlag, boolean>>;

const DEFAULTS: Record<FeatureFlag, boolean> = {
  ai_scheduler: true,
  chat: true,
  calendar_sync: true,
  automations: true,
  facility_billing: true,
  forms: true,
  knowledge_base: true,
  pwa: true,
};

export function resolveFlags(stored?: FeatureFlagMap | null): Record<FeatureFlag, boolean> {
  const flags = { ...DEFAULTS, ...stored };
  if (!process.env.OPENAI_API_KEY && !process.env.AI_PROVIDER) flags.ai_scheduler = stored?.ai_scheduler ?? true;
  return flags;
}

export function featureEnabled(stored: FeatureFlagMap | null | undefined, flag: FeatureFlag) {
  return resolveFlags(stored)[flag];
}
