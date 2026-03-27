export const storeTypes = ['wedding_dresses', 'engagement_rings'] as const;

export type StoreType = (typeof storeTypes)[number];

export const defaultStoreType: StoreType = 'wedding_dresses';

export function getStoreTypeLabel(type: StoreType) {
  return type === 'engagement_rings' ? 'Engagement Rings' : 'Wedding Dresses';
}
