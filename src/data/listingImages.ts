import type { ImageSourcePropType } from 'react-native';

/** Photos bundled with the app, by listing id (book covers, and later partner photos). */
export const LISTING_IMAGES: Record<string, ImageSourcePropType> = {
  'books-saca-tu-mejor-version': require('../../assets/books/saca-tu-mejor-version-1-cover.jpg'),
  'books-el-alma-perdida': require('../../assets/books/el-alma-perdida-1-cover.jpg'),
};

/** Extra photos a guest can swipe through by tapping the cover. The first one is the cover. */
export const LISTING_GALLERIES: Record<string, ImageSourcePropType[]> = {
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
