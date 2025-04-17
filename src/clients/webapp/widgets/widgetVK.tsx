import React, { useState } from 'react';
import { diff } from '../../../common.ts';
import log from '../../log.ts';
import { getProps, updateAudioDownloadLinks, updateHrefParams } from '../common.ts';
import SelectVK from '../../components/libxul/selectVK.tsx';

import type {
  SelectVKProps,
  SelectVKType,
} from '../../components/libxul/selectVK.tsx';
import type { WidgetVKData } from './defaultSettings.ts';

// A React component widget for selection of a Bible verse from any Bible verse
// system or installed Bible module.

// This widget's selectVK will keep its own state unless settings.data is set.
// When it is set, the SelectVK will become a controlled component and only
// chapters listed in chaplist will be available for selection.

export type WidgetVKProps = {
  compid: string;
  settings: WidgetVKData;
};

export type WidgetVKState = Omit<SelectVKProps, 'onSelection'>;

export default function WidgetVK(wprops: WidgetVKProps): React.JSX.Element {
  const { compid, settings } = wprops;
  const { action, props, data, data2 } = settings;

  const onSelectVK = (selection?: SelectVKType): void => {
    if (selection) {
      const { book, chapter } = selection;
      setState((ps) => {
        const prevState = ps as SelectVKProps;
        let newState = prevState;
        const chapterArray = data?.[book];
        if (chapterArray) {
          const s = {
            ...prevState,
            initialVK: selection,
            options: {
              ...prevState.options,
              chapters: chapterArray.map((x) => x[0]).sort((a, b) => a - b),
            },
          };
          if (prevState.initialVK.book !== book) s.initialVK.chapter = 1;
          if (typeof diff(s, prevState) !== 'undefined') newState = s;
        }
        if (action && newState !== prevState) {
          switch (action) {
            case 'bible_audio_Play': {
              const comParent = document.getElementById(compid)?.parentElement;
              const player = comParent?.querySelector('audio') as
                | HTMLAudioElement
                | undefined;
              if (player) {
                const chaparray =
                  data && data[book]?.find((ca) => ca[0] === chapter);
                if (chaparray) {
                  player.setAttribute(
                    'src',
                    chaparray[1].replace(/^base:/, ''),
                  );
                  player.play().catch(() => {});
                }
              }
              updateLinks(selection);
              break;
            }
            default: {
              log.error(`Unknown selectVK action: '${action}'`);
            }
          }
        }
        return newState;
      });
    }
  };

  const updateLinks = (selection: SelectVKType, isReset = false) => {
    const { book, chapter } = selection;
    const comParent = document.getElementById(compid)?.parentElement;
    const link = comParent?.querySelector('.update_url a, a.update_url') as
      | HTMLAnchorElement
      | undefined;
    if (link) updateHrefParams(link, { verse: `~${book}.${chapter}` });
    if (comParent && data && data2)
      updateAudioDownloadLinks(comParent, selection, data, data2, isReset);
  };

  const [state, setState] = useState(() => {
    const s = getProps(props, {
      initialVK: { book: 'Gen', chapter: 1, v11n: 'KJV' },
      options: {},
      disabled: false,
      allowNotInstalled: true,
    });
    // If VK chaplist is set and contains at least one chapter, make sure
    // initial VK is in the Chaplist, and the selecVK shows only chapters
    // in Chaplist.
    if (data) {
      const books = Object.keys(data);
      if (books.length) {
        const vk = s.initialVK;
        const { book } = vk;
        if (!books.includes(book)) {
          vk.book = books[0] as any;
          const ts = data[vk.book];
          if (ts) [[vk.chapter]] = ts;
        }
        if (!data[vk.book]?.find((x) => x[0] === vk.chapter)) {
          vk.chapter = (data[vk.book] as any)[0][0] || 1;
        }
        if (typeof s.options === 'undefined') s.options = {};
        s.options.books = Object.keys(data);
        s.options.chapters = data[vk.book]
          ?.map((x) => x[0])
          .sort((a, b) => a - b) ?? [vk.chapter];
      }
    }

    updateLinks(s.initialVK, true);

    return s;
  });

  return <SelectVK onSelection={onSelectVK} {...(state as any)} />;
}
