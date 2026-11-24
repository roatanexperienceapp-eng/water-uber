import type { ImageSourcePropType } from 'react-native';

/** Photos bundled with the app, by listing id (book covers, and later partner photos). */
export const LISTING_IMAGES: Record<string, ImageSourcePropType> = {
  'jet-roa-live-jet-ski-rental': require('../../assets/jet/jet-roa-live-jet-ski-rental.jpg'),
  'jet-blue-water-beach-co': require('../../assets/jet/jet-blue-water-beach-co.jpg'),
  'jet-joyride-adventure-roatan': require('../../assets/jet/jet-joyride-adventure-roatan.jpg'),
  'jet-sunshine-powersport-rentals': require('../../assets/jet/jet-sunshine-powersport-rentals.jpg'),
  'jet-snorkel-roatan': require('../../assets/jet/jet-snorkel-roatan.jpg'),
  'jet-rankin-water-adventures': require('../../assets/jet/jet-rankin-water-adventures.jpg'),
  'books-saca-tu-mejor-version': require('../../assets/books/saca-tu-mejor-version.jpg'),
};
