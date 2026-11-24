import type { ImageSourcePropType } from 'react-native';

/** Photos bundled with the app, by listing id (book covers, and later partner photos). */
export const LISTING_IMAGES: Record<string, ImageSourcePropType> = {
  'jet-roa-live-jet-ski-rental': require('../../assets/jet/jet-roa-live-jet-ski-rental.jpg'),
  'jet-blue-water-beach-co': require('../../assets/jet/jet-blue-water-beach-co.jpg'),
  'jet-joyride-adventure-roatan': require('../../assets/jet/jet-joyride-adventure-roatan.jpg'),
  'jet-sunshine-powersport-rentals': require('../../assets/jet/jet-sunshine-powersport-rentals.jpg'),
  'jet-snorkel-roatan': require('../../assets/jet/jet-snorkel-roatan.jpg'),
  'jet-rankin-water-adventures': require('../../assets/jet/jet-rankin-water-adventures.jpg'),
  'horse-west-bay-beach-ride': require('../../assets/horse/horse-west-bay-beach-ride.jpg'),
  'horse-west-bay-tours': require('../../assets/horse/horse-west-bay-tours.jpg'),
  'catering-aidas-kitchen': require('../../assets/catering/aidas-kitchen.jpg'),
  'books-saca-tu-mejor-version': require('../../assets/books/saca-tu-mejor-version-1-cover.jpg'),
  'books-el-alma-perdida': require('../../assets/books/el-alma-perdida-1-cover.jpg'),
  'books-luna-encuentra-el-camino-a-casa': require('../../assets/books/luna-encuentra-el-camino-a-casa.jpg'),
  'nsnork-our-night-snorkel': require('../../assets/nightsnorkel/01-basket-star.jpg'),
  'nsnork-corey': require('../../assets/nightsnorkel/01-basket-star.jpg'),
};

/** Extra photos a guest can swipe through by tapping the cover. The first one is the cover. */
const NIGHT_SNORKEL: ImageSourcePropType[] = [
  require('../../assets/nightsnorkel/01-basket-star.jpg'),
  require('../../assets/nightsnorkel/02-octopus.jpg'),
  require('../../assets/nightsnorkel/03-crab.jpg'),
  require('../../assets/nightsnorkel/04-cowfish.jpg'),
  require('../../assets/nightsnorkel/05-barracuda.jpg'),
  require('../../assets/nightsnorkel/06-sea-fan.jpg'),
  require('../../assets/nightsnorkel/07-urchin.jpg'),
  require('../../assets/nightsnorkel/08-trunkfish.jpg'),
  require('../../assets/nightsnorkel/09-scorpionfish.jpg'),
  require('../../assets/nightsnorkel/10-trumpetfish.jpg'),
  require('../../assets/nightsnorkel/11-grouper.jpg'),
  require('../../assets/nightsnorkel/12-guests-1.jpg'),
  require('../../assets/nightsnorkel/13-guests-2.jpg'),
  ];

export const LISTING_GALLERIES: Record<string, ImageSourcePropType[]> = {
  'nsnork-our-night-snorkel': NIGHT_SNORKEL,
  'nsnork-corey': NIGHT_SNORKEL,
  'books-saca-tu-mejor-version': [
    require('../../assets/books/saca-tu-mejor-version-1-cover.jpg'),
    require('../../assets/books/saca-tu-mejor-version-2-about.jpg'),
    require('../../assets/books/saca-tu-mejor-version-3-details.jpg'),
    require('../../assets/books/saca-tu-mejor-version-4-back.jpg'),
  ],
  'books-el-alma-perdida': [
    require('../../assets/books/el-alma-perdida-1-cover.jpg'),
    require('../../assets/books/el-alma-perdida-2-about.jpg'),
    require('../../assets/books/el-alma-perdida-3-details.jpg'),
    require('../../assets/books/el-alma-perdida-4-back.jpg'),
  ],
};
