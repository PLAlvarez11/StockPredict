import {
  BabyCarriage,
  CrownSimple,
  Diamond,
  Dress,
  Flask,
  Gift,
  HairDryer,
  HandbagSimple,
  Heart,
  PaintBrush,
  Sneaker,
  Sunglasses,
  Tag,
  TShirt,
  Watch,
  type Icon,
} from '@phosphor-icons/react';

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

export const DETALLE_ICONOS: Record<IconoCategoria, { nombre: string; Icono: Icon }> = {
  't-shirt': { nombre: 'Camiseta', Icono: TShirt },
  'paint-brush': { nombre: 'Pincel', Icono: PaintBrush },
  'handbag-simple': { nombre: 'Bolso', Icono: HandbagSimple },
  flask: { nombre: 'Frasco', Icono: Flask },
  sunglasses: { nombre: 'Lentes', Icono: Sunglasses },
  dress: { nombre: 'Vestido', Icono: Dress },
  sneaker: { nombre: 'Tenis', Icono: Sneaker },
  watch: { nombre: 'Reloj', Icono: Watch },
  diamond: { nombre: 'Diamante', Icono: Diamond },
  'crown-simple': { nombre: 'Corona', Icono: CrownSimple },
  'hair-dryer': { nombre: 'Secadora', Icono: HairDryer },
  'baby-carriage': { nombre: 'Coche de bebé', Icono: BabyCarriage },
  gift: { nombre: 'Regalo', Icono: Gift },
  heart: { nombre: 'Corazón', Icono: Heart },
  tag: { nombre: 'Etiqueta', Icono: Tag },
};

export function iconoDe(nombre: string): Icon {
  return (DETALLE_ICONOS as Record<string, { Icono: Icon }>)[nombre]?.Icono ?? Tag;
}
