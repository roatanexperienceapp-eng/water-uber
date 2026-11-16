import type { ImageSourcePropType } from 'react-native';

/**
 * Round illustrations for the Explore tiles. One family: every tile is a full island scene in the
 * same outlined style, with no lettering, so the translated label underneath works in every language.
 * Portals without art fall back to their emoji. `paddle` is ready for the Paddleboarding tile.
 */
export const PORTAL_ART: Partial<Record<string, ImageSourcePropType>> = {
  fish: require('../../assets/images/portals/fish.jpg'),
  snork: require('../../assets/images/portals/snork.jpg'),
  dive: require('../../assets/images/portals/dive.jpg'),
  jet: require('../../assets/images/portals/jet.jpg'),
  para: require('../../assets/images/portals/para.jpg'),
  car: require('../../assets/images/portals/car.jpg'),
  land: require('../../assets/images/portals/land.jpg'),
  zip: require('../../assets/images/portals/zip.jpg'),
  park: require('../../assets/images/portals/park.jpg'),
  rx: require('../../assets/images/portals/rx.jpg'),
  med: require('../../assets/images/portals/med.jpg'),
  hotel: require('../../assets/images/portals/hotel.jpg'),
  food: require('../../assets/images/portals/food.jpg'),
  merch: require('../../assets/images/portals/merch.jpg'),
  nsnork: require('../../assets/images/portals/nsnork.jpg'),
  horse: require('../../assets/images/portals/horse.jpg'),
  jetcar: require('../../assets/images/portals/jetcar.jpg'),
  books: require('../../assets/images/portals/books.jpg'),
  paddle: require('../../assets/images/portals/paddle.jpg'),
};
