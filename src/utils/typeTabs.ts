/** Selected type tab: every type, a type name, or rows without a type. */
export const ALL_TYPES = '__all__';
export const NO_TYPE = '__none__';

/** Whether a row with type `itemType` belongs to the selected tab. */
export const inTypeTab = (tab: string, itemType: string | null | undefined) =>
  tab === ALL_TYPES || (tab === NO_TYPE ? !itemType : itemType === tab);
