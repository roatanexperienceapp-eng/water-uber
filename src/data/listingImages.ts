import type { ImageSourcePropType } from 'react-native';

/** Photos bundled with the app, by listing id (book covers, and later partner photos). */
export const LISTING_IMAGES: Record<string, ImageSourcePropType> = {
  'books-saca-tu-mejor-version': require('../../assets/books/saca-tu-mejor-version.jpg'),
};
