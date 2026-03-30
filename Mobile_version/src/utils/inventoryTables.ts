import { StoreType } from '../types/store';

export type InventorySchemaConfig = {
  itemTable: 'dresses' | 'rings';
  imageTable: 'dress_images' | 'ring_images';
  imageRelationField: 'dress_images' | 'ring_images';
  itemForeignKey: 'dress_id' | 'ring_id';
  titlePlural: 'dresses' | 'rings';
  titleSingular: 'dress' | 'ring';
};

export function getInventorySchemaConfig(storeType: StoreType): InventorySchemaConfig {
  if (storeType === 'engagement_rings') {
    return {
      itemTable: 'rings',
      imageTable: 'ring_images',
      imageRelationField: 'ring_images',
      itemForeignKey: 'ring_id',
      titlePlural: 'rings',
      titleSingular: 'ring'
    };
  }

  return {
    itemTable: 'dresses',
    imageTable: 'dress_images',
    imageRelationField: 'dress_images',
    itemForeignKey: 'dress_id',
    titlePlural: 'dresses',
    titleSingular: 'dress'
  };
}
