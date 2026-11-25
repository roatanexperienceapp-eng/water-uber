import type { ImageSourcePropType } from 'react-native';

/** Photos bundled with the app, by listing id (book covers, and later partner photos). */
export const LISTING_IMAGES: Record<string, ImageSourcePropType> = {
  'hydro-roatan-hydrobikes': require('../../assets/wateradv/hydrobike.jpg'),
  'flyboard-west-bay': require('../../assets/wateradv/flyboard.jpg'),
  'kite-kitesurf-roatan': require('../../assets/wateradv/kitesurf.jpg'),
  'kite-kite-honduras': require('../../assets/wateradv/kitesurf.jpg'),
  'glassbottom-reef-explorer': require('../../assets/wateradv/glassbottom.jpg'),
  'sub-stanley-idabel': require('../../assets/wateradv/submarine.jpg'),
  'paddle-roatan-paddle-boards': require('../../assets/paddle/roatan-paddle-boards-1.jpg'),
  'car-racing-rent-a-car': require('../../assets/cars/car-racing-rent-a-car.jpg'),
  'car-cheap-car-rental': require('../../assets/cars/car-cheap-car-rental.jpg'),
  'car-carmania': require('../../assets/cars/car-carmania.jpg'),
  'car-dolphin-rental-car': require('../../assets/cars/car-dolphin-rental-car.jpg'),
  'car-rent-a-car-roatan': require('../../assets/cars/car-rent-a-car-roatan.jpg'),
  'car-roatan-car-rental': require('../../assets/cars/car-roatan-car-rental.jpg'),
  'car-tonys-rent-a-car': require('../../assets/cars/car-tonys-rent-a-car.jpg'),
  'car-ramirez-rent-a-car': require('../../assets/cars/car-ramirez-rent-a-car.jpg'),
  'para-roatan-tucan-adventures': require('../../assets/para/para-roatan-tucan-adventures.jpg'),
  'para-roatan-tour-guide-association': require('../../assets/para/para-roatan-tour-guide-association.jpg'),
  'para-roatan-breakaway-tours': require('../../assets/para/para-roatan-breakaway-tours.jpg'),
  'para-roatan-activities-hn-oficial': require('../../assets/para/para-roatan-activities-hn-oficial.jpg'),
  'para-roatan-exclusive': require('../../assets/para/para-roatan-exclusive.jpg'),
  'para-at21-tours-roatan': require('../../assets/para/para-at21-tours-roatan.jpg'),
  'para-roatan-water-activities-and-tours': require('../../assets/para/para-roatan-water-activities-and-tours.jpg'),
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
  'paddle-roatan-paddle-boards': [
    require('../../assets/paddle/roatan-paddle-boards-1.jpg'),
    require('../../assets/paddle/roatan-paddle-boards-2.jpg'),
  ],
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
