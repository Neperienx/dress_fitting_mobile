import { getTagCatalogByStoreType } from '../data/tagCatalogs';
import { StoreType } from '../types/store';

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

export type DebugGeneratedInventoryProfile = {
  name: string;
  imageUris: string[];
  suggestedTags: string[];
};

const openAiImagesUrl = 'https://api.openai.com/v1/images/generations';
const debugImageModel = 'gpt-image-1';
const debugImageSize = '1024x1536';
const debugImageQuality = 'medium';

function isDevelopmentRuntime() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function getPublicEnvValue(name: string) {
  return typeof process !== 'undefined' ? process.env?.[name]?.trim() ?? '' : '';
}

function getDebugOpenAiApiKey() {
  if (!isDevelopmentRuntime()) {
    return '';
  }

  return getPublicEnvValue('EXPO_PUBLIC_DEBUG_OPENAI_API_KEY');
}

export function getOpenAiInventoryDebugStatus() {
  const available = isDevelopmentRuntime();
  const enabled = available && getPublicEnvValue('EXPO_PUBLIC_ENABLE_OPENAI_INVENTORY_DEBUG') === 'true';
  const hasApiKey = getDebugOpenAiApiKey().length > 0;

  return { available, enabled, hasApiKey };
}

function normalizeForMatching(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseFromPrompt(prompt: string, itemLabel: string) {
  const compact = prompt
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 7)
    .join(' ');

  if (!compact) {
    return `Generated ${itemLabel}`;
  }

  return compact
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

export function suggestInventoryTagsFromPrompt(prompt: string, storeType: StoreType) {
  const normalizedPrompt = normalizeForMatching(prompt);
  if (!normalizedPrompt) {
    return [];
  }

  const catalog = getTagCatalogByStoreType(storeType);
  const matches = catalog.categories.flatMap((category) =>
    category.tags.filter((tag) => normalizedPrompt.includes(normalizeForMatching(tag)))
  );

  return Array.from(new Set(matches)).slice(0, 12);
}

function buildImagePrompt(prompt: string, storeType: StoreType, poseIndex: number) {
  const subject = storeType === 'engagement_rings' ? 'engagement ring product' : 'wedding dress';
  const poseDirection =
    storeType === 'engagement_rings'
      ? ['front hero angle', 'side profile angle', 'top-down detail angle'][poseIndex] ?? 'alternate product angle'
      : ['front pose', 'three-quarter walking pose', 'back pose'][poseIndex] ?? 'alternate editorial pose';

  return [
    `Create a realistic boutique inventory photo of the same ${subject}.`,
    `Design prompt: ${prompt}`,
    `View: ${poseDirection}.`,
    'Use a clean neutral studio background, consistent item identity, detailed materials, catalog-ready lighting, no text, no watermark.'
  ].join(' ');
}

async function generateOneDebugImage(params: {
  apiKey: string;
  prompt: string;
  storeType: StoreType;
  poseIndex: number;
}) {
  const response = await fetch(openAiImagesUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: debugImageModel,
      prompt: buildImagePrompt(params.prompt, params.storeType, params.poseIndex),
      size: debugImageSize,
      quality: debugImageQuality,
      output_format: 'jpeg'
    })
  });

  const payload = (await response.json()) as OpenAiImageResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI image request failed with HTTP ${response.status}.`);
  }

  const firstImage = payload.data?.[0];
  if (firstImage?.b64_json) {
    return `data:image/jpeg;base64,${firstImage.b64_json}`;
  }

  if (firstImage?.url) {
    return firstImage.url;
  }

  throw new Error('OpenAI did not return an image payload.');
}

export async function generateDebugInventoryProfile(params: {
  prompt: string;
  storeType: StoreType;
  imageCount: 2 | 3;
}) {
  const status = getOpenAiInventoryDebugStatus();
  if (!status.available) {
    throw new Error('OpenAI inventory debug generation is only available in development builds.');
  }

  const apiKey = getDebugOpenAiApiKey();
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_DEBUG_OPENAI_API_KEY. Add it to Mobile_version/.env.local, then restart Expo.');
  }

  const trimmedPrompt = params.prompt.trim();
  if (!trimmedPrompt) {
    throw new Error('Enter a prompt before generating images.');
  }

  const imageUris = await Promise.all(
    Array.from({ length: params.imageCount }, (_, poseIndex) =>
      generateOneDebugImage({
        apiKey,
        prompt: trimmedPrompt,
        storeType: params.storeType,
        poseIndex
      })
    )
  );

  const itemLabel = params.storeType === 'engagement_rings' ? 'ring' : 'dress';

  return {
    name: titleCaseFromPrompt(trimmedPrompt, itemLabel),
    imageUris,
    suggestedTags: suggestInventoryTagsFromPrompt(trimmedPrompt, params.storeType)
  };
}
