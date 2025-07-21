/* eslint-disable @typescript-eslint/naming-convention */
import type C from '../../../constant.ts';
import type { MenulistProps } from '../../components/libxul/menulist.tsx';
import type { SelectORProps } from '../../components/libxul/selectOR.tsx';
import type { SelectVKProps } from '../../components/libxul/selectVK.tsx';
import type { AllComponentsData } from '../common.ts';

export type WidgetActions =
  | 'bible_audio_Play'
  | 'genbk_audio_Play'
  | 'update_url';

export type WidgetVKData = {
  component: 'selectVK';
  actions?: WidgetActions[];
  langcode: (typeof C.Locales)[number][0];
  props: Omit<SelectVKProps, 'onSelection'>;
  data?: ChaplistType;
  update_url?: UpdateLUrlDataType;
};

export type WidgetORData = {
  component: 'selectOR';
  actions?: WidgetActions[];
  langcode: (typeof C.Locales)[number][0];
  props: Omit<SelectORProps, 'onSelection'>;
  data: ChaplistType;
  update_url?: UpdateLUrlDataType;
};

export type WidgetMenulistData = {
  component: 'selectMenulist';
  actions?: WidgetActions[];
  langcode: (typeof C.Locales)[number][0];
  props: Omit<MenulistProps, 'onChange'>;
  data: {
    urlroot: string;
    items: FileItem[] | FileItem[][] | string[];
  };
};

export type FileItem = {
  ntitle: string;
  mid: number;
  size?: string;
  relurl?: string;
  full?: boolean;
  label?: string;
};

export type ZipData = [ch1: number, ch2: number, size: number];

export type ChaplistType = {
  [parent: string]: Array<
    [
      chapter: number | string,
      url: string,
      size: number,
      mid: number,
      zip: ZipData,
      dlkey: 'book' | 'chapters',
    ]
  >;
};

export type UpdateLUrlDataType = {
  [className: string]: string | { [dlkey: string]: string };
  urlTemplate: string;
};

const defaultSettings: AllComponentsData = {
  react: {
    selectVK_1: {
      component: 'selectVK',
      langcode: 'en',
      props: {
        initialVK: {
          book: 'Matt',
          chapter: 1,
          v11n: 'KJV',
        },
      },
    },

    selectOR_1: {
      component: 'selectOR',
      langcode: 'en',
      props: {
        initialORM: {
          otherMod: 'modname',
          keys: ['First chapter'],
        },
      },
      data: {
        '': [
          ['000 First chapter', '', 1000000, 0, [1, 2, 200000], 'chapters'],
          ['001 Second chapter', '', 1000000, 0, [1, 2, 200000], 'chapters'],
        ],
      },
    },

    selectMenulist_1: {
      component: 'selectMenulist',
      langcode: 'en',
      props: {
        value: 'Item 1',
      },
      data: {
        urlroot: '/some-url',
        items: ['Item 1', 'Item 2'],
      },
    },
  },
};

export default defaultSettings;
