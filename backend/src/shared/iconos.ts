export const ICONOS_CATEGORIA = [
  't-shirt',
  'paint-brush',
  'handbag-simple',
  'flask',
  'sunglasses',
  'dress',
  'sneaker',
  'watch',
  'diamond',
  'crown-simple',
  'hair-dryer',
  'baby-carriage',
  'gift',
  'heart',
  'tag',
] as const;

export type IconoCategoria = (typeof ICONOS_CATEGORIA)[number];
