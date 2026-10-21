import type { ImageSourcePropType } from 'react-native';

/**
 * Round illustrations for the Explore tiles (owner-supplied artwork, text cropped out so the
 * translated label underneath works in every language). Portals without art fall back to their emoji.
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
};
