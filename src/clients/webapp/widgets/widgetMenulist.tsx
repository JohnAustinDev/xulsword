import React, { useEffect, useState } from 'react';
import log from '../../log.ts';
import { G } from '../../G.ts';
import { clone, randomID } from '../../../common.ts';
import Menulist from '../../components/libxul/menulist.tsx';
import { getProps } from '../common.ts';

import type { ChangeEvent } from 'react';
import type { MenulistProps } from '../../components/libxul/menulist.tsx';
import type { FileItem, WidgetMenulistSettings } from './defaultSettings.ts';

// A React component widget for selection from a set of options, such as a set
// of eBook files.

export type WidgetMenulistProps = {
  compid: string;
  settings: WidgetMenulistSettings;
};

export type WidgetMenulistState = Omit<MenulistProps, 'onChange'>;

export default function WidgetMenulist(
  wprops: WidgetMenulistProps,
): React.JSX.Element {
  const { compid, settings } = wprops;
  const { action, props, data } = settings;

  const [state, setState] = useState(() => {
    return getProps(props, {
      disabled: false,
      multiple: false,
      value: '0',
    });
  });

  useEffect(() => {
    const { value } = state;
    const index = value && typeof value === 'string' ? Number(value) || 0 : 0;
    if (action && data) {
      const { title, urlroot, items } = data;
      switch (action) {
        case 'update_url': {
          const elem = document.getElementById(compid)?.previousElementSibling;
          const item = items[index];
          if (elem && item && typeof item === 'object') {
            const { relurl, size } = item;
            const a = elem.querySelector('a');
            if (a && relurl) {
              a.setAttribute('href', `${urlroot}/${relurl}`);
              a.textContent = optionText(item, true, title, items.length === 1);
              if (size && a.parentElement?.tagName === 'SPAN') {
                const sizeSpan = a.parentElement.nextElementSibling;
                if (sizeSpan && sizeSpan.tagName === 'SPAN') {
                  sizeSpan.textContent = ` (${size})`;
                }
              }
            }
          }
          break;
        }
        default: {
          log.error(`Unknown selectMenulist action: '${action}'`);
        }
      }
    }
  }, [state.value]);

  function onChange(
    e: React.SyntheticEvent<HTMLSelectElement, ChangeEvent>,
  ): void {
    const select = e.target as HTMLSelectElement;
    setState((prevState) => {
      const newState = clone(prevState);
      newState.value = select.value;
      return newState;
    });
    jQuery(`#${compid}`).prev().fadeTo(1, 0).fadeTo(1000, 1);
  }

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

function optionKey(data: string | FileItem): string {
  if (data && typeof data === 'string') return randomID();
  const { relurl } = data as FileItem;
  return relurl || randomID();
}

function optionText(
  data: string | FileItem,
  long = false,
  title = '',
  onlyOption = false,
): string {
  if (typeof data === 'string') return data;
  return getEBookTitle(data, long, title, onlyOption);
}

// Generate either a short or long title for an eBook file. The forms of the title are dependent on type:
//        |        full, compilation            |             part                    |        other
// short: | 'Full publication' or 'Compilation' | books (for bible)                   | title (for all others).
// long:  | publication-name,                   | books: publication-name (for bible) | title: publication-name (others)
function getEBookTitle(
  data: FileItem,
  longTitle = false,
  pubTitle = '',
  isOnlyOption = false,
): string {
  const { types, osisbook, name } = data;
  const Book = G.Book(G.i18n.language);
  if (types) {
    if (
      !isOnlyOption &&
      ['full', 'compilation'].some((x) => types.includes(x))
    ) {
      return longTitle ? pubTitle : G.i18n.t('Full publication');
    } else if (osisbook && types.includes('part')) {
      return longTitle
        ? `${Book[osisbook].name}: ${pubTitle}`
        : Book[osisbook].name;
    }
  }
  return longTitle && name !== pubTitle ? `${name}: ${pubTitle}` : name;
}
