/* eslint-disable @typescript-eslint/naming-convention */
import type { OSISBookType } from '../../../type.ts';
import type { AllComponentsData } from '../common.ts';
import type C from '../../../constant.ts';
import type { MenulistProps } from '../../components/libxul/menulist.tsx';
import type { SelectORProps } from '../../components/libxul/selectOR.tsx';
import type { SelectVKProps } from '../../components/libxul/selectVK.tsx';

export type WidgetVKSettings = {
  component: 'selectVK';
  action?: 'bible_audio_Play';
  langcode: (typeof C.Locales)[number][0];
  props: Omit<SelectVKProps, 'onSelection'>;
  data?: ChaplistVKType;
};

export type WidgetORSettings = {
  component: 'selectOR';
  action?: 'genbk_audio_Play';
  langcode: (typeof C.Locales)[number][0];
  props: Omit<SelectORProps, 'onSelection'>;
  data: ChaplistORType;
};

export type WidgetMenulistSettings = {
  component: 'selectMenulist';
  action?: 'update_url';
  langcode: (typeof C.Locales)[number][0];
  props: Omit<MenulistProps, 'onChange'>;
  data: {
    urlroot: string;
    items: FileItem[] | FileItem[][] | string[];
  };
};

export type FileItem = {
  name: string;
  size?: string;
  relurl?: string;
  full?: boolean;
  types?: string[];
  scope?: string;
};

export type ChaplistVKType = {
  [bk in OSISBookType]?: Array<[chapnum: number, url: string]>;
};

export type ChaplistORType = Array<
  [orderSlashDelimited: string, chapterSlashDelimited: string, url: string]
>;

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
      data: [
        ['0', 'First chapter', ''],
        ['1', 'Second chapter', ''],
      ],
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
