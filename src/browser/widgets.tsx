import React, { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SocketConnect from './preload.ts';
import {
  handleAction,
  createNodeList,
  setGlobalLocale,
  getProps,
  writePrefsStores,
  optionKey,
  optionText,
  componentData,
} from './bcommon.ts';
import { clone, diff } from '../common.ts';
import C from '../constant.ts';
import G from '../renderer/rg.ts';
import log from '../renderer/log.ts';
import { callBatchThenCache } from '../renderer/renderPromise.ts';
import SelectVK from '../renderer/libxul/selectVK.tsx';
import SelectOR from '../renderer/libxul/selectOR.tsx';
import Menulist from '../renderer/libxul/menulist.tsx';

import type { ChangeEvent } from 'react';
import type { GCallType, PrefRoot } from '../type.ts';
import type { ChaplistVKType, ChaplistORType, SelectData } from './bcommon.ts';
import type {
  SelectVKProps,
  SelectVKType,
} from '../renderer/libxul/selectVK.tsx';
import type {
  SelectORMType,
  SelectORProps,
} from '../renderer/libxul/selectOR.tsx';
import type { MenulistProps } from '../renderer/libxul/menulist.tsx';

// Each SelectVK will keep its own state, providing chapter selection from any
// installed SWORD module, unless the chaplist is set. In that case the SelectVK
// will become a controlled component where only chapters listed in data-chaplist
// will be available for selection.
function ControllerVK(props: {
  compid: string;
  initial: Omit<SelectVKProps, 'onSelection'>;
  chaplist?: ChaplistVKType;
  action?: string;
}): React.JSX.Element {
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
          if (ts) vk.chapter = ts[0][0];
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

function ControllerOR(props: {
  compid: string;
  initial: Partial<SelectORProps>;
  chaplist?: ChaplistORType;
  action?: string;
}): React.JSX.Element {
  const { compid, initial } = props;

  const onSelectOR = (selection?: SelectORMType): void => {
    const { action, chaplist } = props;
    if (action) handleAction(action, compid, selection, chaplist);
  };

  const [state] = useState(() => {
    return getProps(initial, {
      initialORM: { otherMod: 'genbk', keys: [] },
      nodeLists: [],
      otherMods: [],
      disabled: false,
      enableMultipleSelection: false,
      enableParentSelection: false,
    });
  });

  return <SelectOR onSelection={onSelectOR} {...(state as any)} />;
}

function ControllerSelect(props: {
  compid: string;
  initial: Omit<MenulistProps, 'onChange'>;
  data?: SelectData;
  action?: string;
}): React.JSX.Element {
  const { initial, data, action, compid } = props;

  // Although this value is a number, MenuList expects a string.
  const { value } = initial;
  if (Number.isInteger(value)) initial.value = value.toString();

  const onChange = (
    e: React.SyntheticEvent<HTMLSelectElement, ChangeEvent>,
  ): void => {
    const select = e.target as HTMLSelectElement;
    setState((prevState: Omit<MenulistProps, 'onChange'>) => {
      const newState = clone(prevState);
      newState.value = select.value;
      return newState;
    });
    jQuery(`#${compid}`).prev().fadeTo(1, 0).fadeTo(1000, 1);
  };

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
    if (data) {
      const { title, base, items } = data;
      if (action && data)
        handleAction(action, compid, title, base, items, index);
    }
  }, [state.value]);

  const options = data
    ? data.items.map((d, i) => (
        <option key={optionKey(d)} value={i.toString()}>
          {optionText(d, false, data.title)}
        </option>
      ))
    : [];

  return (
    <Menulist onChange={onChange} {...(state as any)}>
      {options}
    </Menulist>
  );
}

const socket = SocketConnect(C.Server.port);
let published = false;
socket.on('connect', () => {
  // connect is called even on reconnect, so only publish this once.
  if (!published) {
    published = true;

    let langcode = 'en';
    const widget = document.getElementsByClassName('widget-container');
    if (widget?.length) {
      const data = componentData(widget[0]);
      langcode = data.langcode;
    }
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
      ['i18n', 't', ['locale_direction']],
      ['i18n', 't', ['Full publication']],
      ...Object.values(C.SupportedTabTypes).map(
        (type) => ['i18n', 't', [type, { lng: locale }]] as any,
      ),
    ];

    callBatchThenCache(preloads)
      .then(() => {
        const widgets = document.getElementsByClassName('widget-container');
        (Array.from(widgets) as HTMLDivElement[]).forEach((widget) => {
          const { id: compid } = widget;
          const compData = componentData(widget);
          const { component } = compData;
          switch (component) {
            case 'selectVK': {
              const { action, data, props } = compData;
              createRoot(widget).render(
                <StrictMode>
                  <ControllerVK
                    compid={compid}
                    action={action}
                    chaplist={data}
                    initial={props}
                  />
                </StrictMode>,
              );
              break;
            }
            case 'selectOR': {
              const { action, data, props } = compData;
              data.forEach((x) => {
                x[0] = x[0].toString();
              });
              if (Array.isArray(data)) {
                createNodeList(data, props);
              }
              createRoot(widget).render(
                <StrictMode>
                  <ControllerOR
                    compid={compid}
                    action={action}
                    chaplist={data}
                    initial={props}
                  />
                </StrictMode>,
              );
              break;
            }
            case 'selectOptions': {
              const { action, data, props } = compData;
              createRoot(widget).render(
                <StrictMode>
                  <ControllerSelect
                    compid={compid}
                    action={action}
                    data={data}
                    initial={props}
                  />
                </StrictMode>,
              );
              break;
            }
            default:
              log.error(`Unknown widget type '${component}'`);
          }
          widget.removeAttribute('data-props');
          widget.removeAttribute('data-chaplist');
        });
      })
      .catch((er) => {
        log.error(er);
      });
  }
});
