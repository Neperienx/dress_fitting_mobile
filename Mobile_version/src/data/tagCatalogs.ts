import { defaultStoreType, StoreType } from '../types/store';

type TagCategory = {
  name: string;
  tags: string[];
};

type TagCatalog = {
  language?: string;
  categories?: TagCategory[];
  tags?: string[];
};

const weddingDressTagCatalog = require('./dress-tags.en.json') as TagCatalog;
const engagementRingTagCatalog = require('./engagement-ring-tags.en.json') as TagCatalog;

function toCategoryList(catalog: TagCatalog) {
  return catalog.categories ?? [{ name: 'Tags', tags: catalog.tags ?? [] }];
}

export function getTagCatalogByStoreType(storeType?: StoreType) {
  const normalizedStoreType = storeType ?? defaultStoreType;
  const catalog = normalizedStoreType === 'engagement_rings' ? engagementRingTagCatalog : weddingDressTagCatalog;

  return {
    language: catalog.language ?? 'English',
    categories: toCategoryList(catalog)
  };
}
