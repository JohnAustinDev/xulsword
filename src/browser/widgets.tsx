import React, { ChangeEvent, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import SocketConnect from './preload.ts';
import { handleAction, decodeJSData, createNodeList, setGlobalLocale, getProps, writePrefsStores, optionKey, optionText } from "./bcommon.ts";
import { clone, diff, randomID } from "../common.ts";
import C from '../constant.ts';
import G from "../renderer/rg.ts";
import log from "../renderer/log.ts";
import { callBatchThenCache } from "../renderer/renderPromise.ts";
import SelectVK from "../renderer/libxul/selectVK.tsx";
import SelectOR from "../renderer/libxul/selectOR.tsx";
import Menulist from "../renderer/libxul/menulist.tsx";

import type { GCallType, PrefRoot } from "../type.ts";
import type { ChaplistVKType, ChaplistORType, SelectData } from "./bcommon.ts";
import type { SelectVKProps, SelectVKType } from "../renderer/libxul/selectVK.tsx";
import type { SelectORMType, SelectORProps } from "../renderer/libxul/selectOR.tsx";
import type { MenulistProps } from "../renderer/libxul/menulist.tsx";

// Each SelectVK will keep its own state, providing chapter selection from any
// installed SWORD module, unless the parent div has a valid data-chaplist
// attribute value. In that case the SelectVK will become a controlled
// component where only chapters listed in data-chaplist will be available
// for selection.
function ControllerVK(
  props: {
    id: string;
    initial: Omit<SelectVKProps, 'onSelection'>;
    chaplist?: ChaplistVKType;
    action?: string;
  }
) {
  const { id, action, initial, chaplist } = props;

  const onSelectVK = (selection?: SelectVKType) => {
    if (selection) {
      const { book } = selection;
      const chaplist = props.chaplist as ChaplistVKType;
      setState((ps) => {
        const prevState = ps as SelectVKProps;
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
  }

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
          if (ts) vk.chapter = ts[0][0];
        }
        if (!chaplist[vk.book]?.find((x) => x[0] == vk.chapter)) {
          vk.chapter = (chaplist[vk.book] as any)[0][0] || 1;
        }
        if (typeof s.options === 'undefined') s.options = {};
        s.options.books = Object.keys(chaplist);
        s.options.chapters =
          chaplist[vk.book]?.map((x) => x[0]).sort((a, b) => a - b) || [vk.chapter];
      }
    }
    return s;
  });

  return (<SelectVK onSelection={onSelectVK} {...state as any} />);
}

function ControllerOR(
  props: {
    id: string;
    initial: Partial<SelectORProps>;
    chaplist?: ChaplistORType;
    action?: string;
  }
) {
  const { id, initial } = props;

  const onSelectOR = (selection?: SelectORMType) => {
    const { action, chaplist } = props;
    if (action) handleAction(action, id, selection, chaplist);
  }

  const [state, _setState] = useState(() => {
    return getProps(initial, {
      initialORM: { otherMod: 'genbk', keys: [] },
      nodeLists: [],
      otherMods: [],
      disabled: false,
      enableMultipleSelection: false,
      enableParentSelection: false,
    });
  });

  return (<SelectOR onSelection={onSelectOR} {...state as any} />);
}

function ControllerSelect(
  props: {
    id: string;
    initial: Omit<MenulistProps, 'onChange'>;
    data?: SelectData;
    action?: string;
  }
) {
  const { initial, data, action, id } = props;

  // Number strings always come from Drupal as numbers, but React.propTypes expects a string value.
  const { value } = initial;
  if (typeof value === 'number') initial.value = (value as any).toString();

  const onChange = (e: React.SyntheticEvent<HTMLSelectElement, ChangeEvent>) => {
    const select = e.target as HTMLSelectElement;
    setState((prevState: Omit<MenulistProps, 'onChange'>) => {
      const newState = clone(prevState);
      newState.value = select.value;
      return newState;
    });
    jQuery(`#${id}`).prev().fadeTo(1, 0).fadeTo(1000, 1);
  }

  const [state, setState] = useState(() => {
    return getProps(initial, {
      disabled: false,
      multiple: false,
      value: '0',
    });
  });

  useEffect(() => {
    const { value } = state;
    const index = value && typeof value === 'string' ? Number(value) || 0 : 0;
    if (action && data) handleAction(action, id, data.title, data.items[index]);
  }, [state.value]);

  const options = data
    ? data.items.map((d, i) =>
        <option key={optionKey(d)} value={i.toString()}>
          {optionText(d, false, data.title)}
        </option>
      )
    : [];

  return <Menulist onChange={onChange} {...state as any}>{options}</Menulist>;
}

const socket = SocketConnect(C.Server.port);
let published = false;
socket.on('connect', () => {
  // connect is called even on reconnect, so only publish this once.
  if (!published) {
    published = true;

    let langcode;
    const widget = document.getElementsByClassName('widget-container')[0];
    if (widget) ({ langcode } = (widget as HTMLDivElement).dataset);
    const prefs: Partial<PrefRoot> = {};
    const locale = setGlobalLocale(prefs, langcode);
    writePrefsStores(G, prefs);

    const preloads: GCallType[] = [
      ['Tab', null, undefined],
      ['Tabs', null, undefined],
      ['BkChsInV11n', null, undefined],
      ['GetBooksInVKModules', null, undefined],
      ['getLocaleDigits', null, [true]],
      ['getLocalizedBooks', null, [true]],
      ['Book', null, [locale]],
      ['i18n','t',['locale_direction']],
      ['i18n','t',['Full publication']],
      ['i18n','t',['supplemental']],
      ...(Object.values(C.SupportedTabTypes)
        .map((type) => ['i18n', 't', [type, { lng: locale }]] as any))
    ];

    callBatchThenCache(preloads).then(() => {
      const widgets = document.getElementsByClassName('widget-container');
      (Array.from(widgets) as HTMLDivElement[])
        .forEach((widget) => {
          const id = randomID();
          widget.setAttribute('id', id);
          const { props: p, data, action, widget: widgetType } = widget.dataset;
          switch (widgetType) {
            case 'selectVK': {
              createRoot(widget).render(
                <StrictMode>
                  <ControllerVK
                    id={id}
                    action={action}
                    chaplist={decodeJSData(data) as ChaplistVKType}
                    initial={decodeJSData(p) as SelectVKProps} />
                </StrictMode>);
              break;
            }
            case 'selectOR': {
              const props = decodeJSData(p) as SelectORProps;
              const chaplist = decodeJSData(data) as ChaplistORType;
              chaplist.forEach((x) => x[0] = x[0].toString());
              if (Array.isArray(chaplist)) {
                createNodeList(chaplist, props);
              }
              createRoot(widget).render(
                <StrictMode>
                  <ControllerOR
                    id={id}
                    action={action}
                    chaplist={chaplist}
                    initial={props} />
                </StrictMode>);
              break;
            }
            case 'selectOptions': {
              createRoot(widget).render(
                <StrictMode>
                  <ControllerSelect
                    id={id}
                    action={action}
                    data={decodeJSData(data) as SelectData}
                    initial={decodeJSData(p) as MenulistProps} />
                </StrictMode>);
              break;
            }
            default: log.error(`Unknown widget type '${widgetType}'`);
          }
          widget.removeAttribute('data-props');
          widget.removeAttribute('data-chaplist');
        });
    });
  }
});
