export const SELECTION_TYPES = [
  'TOP_3',
  'PERM_3',
  'TOP_2',
  'BOTTOM_2',
  'SINGLE_TOP',
  'SINGLE_BOTTOM',
  'RUNNING_MIX',
] as const;

export type SelectionType = (typeof SELECTION_TYPES)[number];

const DIGITS: Record<SelectionType, number> = {
  TOP_3: 3,
  PERM_3: 3,
  TOP_2: 2,
  BOTTOM_2: 2,
  SINGLE_TOP: 1,
  SINGLE_BOTTOM: 1,
  RUNNING_MIX: 1,
};

export function isSelectionType(value: string): value is SelectionType {
  return (SELECTION_TYPES as readonly string[]).includes(value);
}

export function digitsFor(type: SelectionType): number {
  return DIGITS[type];
}

export function numberMatchesType(type: SelectionType, number: string): boolean {
  const digits = DIGITS[type];
  return new RegExp(`^\\d{${digits}}$`).test(number);
}
