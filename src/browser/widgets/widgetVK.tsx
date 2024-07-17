import React, { useState } from 'react';
import { handleAction, getProps } from '../bcommon.ts';
import { diff } from '../../common.ts';

import SelectVK from '../../renderer/libxul/selectVK.tsx';

import type { ChaplistVKType } from '../bcommon.ts';
import type {
  SelectVKProps,
  SelectVKType,
} from '../../renderer/libxul/selectVK.tsx';

// A React component widget for selection of a Bible verse from a Bible verse system
// or SWORD Bible module.

// The widget's SelectVK will keep its own state, providing chapter selection from any
// installed SWORD module, unless the chaplist is set. In that case the SelectVK
// will become a controlled component where only chapters listed in data-chaplist
// will be available for selection.

export type WidgetVKProps = {
  compid: string;
  initial: WidgetVKState;
  chaplist?: ChaplistVKType;
  action?: string;
};

export type WidgetVKState = Omit<SelectVKProps, 'onSelection'>;

export default function WidgetVK(props: WidgetVKProps): React.JSX.Element {
  const { compid, action, initial, chaplist } = props;

  const onSelectVK = (selection?: SelectVKType): void => {
    if (selection) {
      const { book } = selection;
      setState((ps) => {
        const prevState = ps as SelectVKProps;
        let newState = prevState;
        const chapterArray = chaplist?.[book];
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
          handleAction(action, compid, selection, chaplist);
        }
        return newState;
      });
    }
  };

  const [state, setState] = useState(() => {
    const s = getProps(initial, {
      initialVK: { book: 'Gen', chapter: 1, v11n: 'KJV' },
      options: {},
      disabled: false,
      allowNotInstalled: true,
    });
    // If VK chaplist is set and contains at least one chapter, make sure
    // initial VK is in the Chaplist, and the selecVK shows only chapters
    // in Chaplist.
    if (chaplist && !Array.isArray(chaplist)) {
      const books = Object.keys(chaplist);
      if (books.length) {
        const vk = s.initialVK;
        const { book } = vk;
        if (!books.includes(book)) {
          vk.book = books[0] as any;
          const ts = chaplist[vk.book];
          if (ts) [[vk.chapter]] = ts;
        }
        if (!chaplist[vk.book]?.find((x) => x[0] === vk.chapter)) {
          vk.chapter = (chaplist[vk.book] as any)[0][0] || 1;
        }
        if (typeof s.options === 'undefined') s.options = {};
        s.options.books = Object.keys(chaplist);
        s.options.chapters = chaplist[vk.book]
          ?.map((x) => x[0])
          .sort((a, b) => a - b) ?? [vk.chapter];
      }
    }
    return s;
  });

  return <SelectVK onSelection={onSelectVK} {...(state as any)} />;
}
