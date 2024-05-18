import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import SocketConnect from './preload.ts';
import { handleAction, decodeJSData, createNodeList } from "./bcommon.ts";
import { diff, randomID } from "../common.ts";
import C from '../constant.ts';
import Subscription from '../subscription.ts';
import { callBatchThenCache } from "../renderer/renderPromise.ts";
import SelectVK from "../renderer/libxul/selectVK.tsx";
import SelectOR from "../renderer/libxul/selectOR.tsx";

import type { GCallType } from "../type.ts";
import type { ChaplistVKType, ChaplistORType, } from "./bcommon.ts";
import type { SelectVKProps, SelectVKType } from "../renderer/libxul/selectVK.tsx";
import type { SelectORMType, SelectORProps } from "../renderer/libxul/selectOR.tsx";

const preloads: GCallType[] = [
  ['Book', null],
  ['Tab', null],
  ['Tabs', null],
  ['BkChsInV11n', null],
  ['GetBooksInVKModules', null],
  ['getLocaleDigits', null, [false]],
  ['getLocalizedBooks', null, [false]],
  ['i18n','t',['locale_direction']],
  ...(Object.values(C.SupportedTabTypes)
    .map((type) => ['i18n', 't', [type]] as any))
];

const selectVKDefault = {
  initialVK: { book: 'Gen', chapter: 1, v11n: 'KJV' },
  options: {},
  disabled: false,
  allowNotInstalled: true,
} as SelectVKProps;

const selectORDefault = {
  initialORM: { otherMod: 'genbk', keys: [] },
  nodeLists: [],
  otherMods: [],
  disabled: false,
  enableMultipleSelection: false,
  enableParentSelection: false,
  onSelection: () => {},
} as SelectORProps;

// React element controller:
function Controller(
  props: {
    id: string;
    selector: 'selectVK' | 'selectOR';
    initial: Partial<SelectVKProps> | Partial<SelectORProps>;
    chaplist?: ChaplistVKType | ChaplistORType;
    action?: string;
  }
) {
  const { id, action, initial, selector, chaplist } = props;
  const [state, setState] = useState(() => {
    // Initialize state values with default and Drupal values.
    const s = {} as SelectVKProps;
    const def = selector === 'selectOR' ? selectORDefault : selectVKDefault;
    Object.entries(def).forEach((entry) => {
      let [prop, v] = entry;
      if (typeof (initial as any)[prop] !== 'undefined') v = (initial as any)[prop];
      (s as any)[prop] = v;
    });
    // If VK chaplist is set and contains at least one chapter, make sure
    // initial VK is in the Chaplist, and the selecVK shows only chapters
    // in Chaplist.
    if (chaplist && !Array.isArray(chaplist) && selector === 'selectVK') {
      const books = Object.keys(chaplist);
      if (books.length) {
        const vk = s.initialVK;
        const { book } = vk;
        if (!books.includes(book)) {
          vk.book = books[0] as any;
          const ts = chaplist[vk.book];
          if (ts) vk.chapter = ts[0][0];
        }
        if (!chaplist[vk.book]?.find((x) => x[0] == vk.chapter)) {
          vk.chapter = (chaplist[vk.book] as any)[0][0] || 1;
        }
        s.options.books = Object.keys(chaplist);
        s.options.chapters =
          chaplist[vk.book]?.map((x) => x[0]).sort((a, b) => a - b) || [vk.chapter];
      }
    }
    return s;
  });

  // If selection has changed, call any action and control the component.
  const onSelectVK = (selection: SelectVKType) => {
    const { book } = selection;
    const chaplist = props.chaplist as ChaplistVKType;
    setState((prevState) => {
      let newState = prevState;
      const chapterArray = chaplist && chaplist[book];
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
        handleAction(action, id, selection, chaplist);
      }
      return newState;
    });
  }

  const onSelectOR = (selection: SelectORMType) => {
    const { action, chaplist } = props;
    if (action) handleAction(action, id, selection, chaplist);
  }

  if (selector === 'selectVK')
    return (<SelectVK {...state} onSelection={onSelectVK} />);
  else if (selector === 'selectOR')
    return (<SelectOR {...state} onSelection={onSelectOR} />);
  return null;
}

// Each SelectVK will keep its own state, providing chapter selection from any
// installed SWORD module, unless the parent div has a valid data-chaplist
// attribute value. In that case the SelectVK will become a controlled
// component where only chapters listed in data-chaplist will be available
// for selection.
Subscription.subscribe.socketConnected((_socket) => {
  callBatchThenCache(preloads).then(() => {
    const selectVKs = document.getElementsByClassName('select-container');
    (Array.from(selectVKs) as HTMLDivElement[])
      .forEach((selectvk) => {
        const id = randomID();
        selectvk.setAttribute('id', id);
        const { props, chaplist: cl, onselect, selector } = selectvk.dataset;
        let chaplist: ChaplistVKType | ChaplistORType | undefined;
        if (cl && selector === 'selectVK') {
          chaplist = decodeJSData(cl) as ChaplistVKType;
        } else if (cl && selector === 'selectOR') {
          chaplist = decodeJSData(cl) as ChaplistORType;
          chaplist.forEach((x) => x[0] = x[0].toString());
        }
        if (props) {
          const initial = decodeJSData(props);
          if (selector === 'selectOR' && Array.isArray(chaplist)) {
            createNodeList(chaplist, initial as SelectORProps);
          }
          createRoot(selectvk).render(
            <StrictMode>
              <Controller
                id={id}
                selector={selector as 'selectVK' | 'selectOR'}
                action={onselect}
                chaplist={chaplist}
                initial={initial as SelectVKProps | SelectORProps} />
            </StrictMode>);
        }
        selectvk.removeAttribute('data-props');
        selectvk.removeAttribute('data-chaplist');
      });
  });
});

const socket = SocketConnect();
let published = false;
socket.on('connect', () => {
  // connect is called even on reconnect, so only publish this once.
  if (socket && !published) Subscription.publish.socketConnected(socket);
  published = true;
});
