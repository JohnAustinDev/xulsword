import React, { useEffect, useState } from 'react';
import log from '../../log.ts';
import { G } from '../../G.ts';
import { randomID } from '../../../common.ts';
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
      const { urlroot, items } = data;
      switch (action) {
        case 'update_url': {
          const elem = document.getElementById(compid)?.parentElement;
          const item = items[index];
          if (elem && typeof item !== 'string') {
            const links = Array.isArray(item) ? item : [item];
            const a = Array.from(elem.querySelectorAll('.update_url a, a.update_url'));
            if (a.length && a.length === links.length) {
              links.forEach((link, x) => {
                const { relurl, size } = link;
                const anchor = a[x];
                if (anchor && relurl) {
                  const root = urlroot.replace(/\/$/, '');
                  const rel = relurl.replace(/^\//, '');
                  anchor.setAttribute('href', `${root}/${rel}`);
                  anchor.textContent = optionText(link, false);
                  if (
                    typeof size !== 'undefined' &&
                    anchor.parentElement?.tagName === 'SPAN'
                  ) {
                    const sizeSpan = anchor.parentElement.nextElementSibling;
                    if (sizeSpan && sizeSpan.tagName === 'SPAN') {
                      sizeSpan.textContent = size ? ` (${size})` : '';
                    }
                  }
                }
              });
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
    setState({ value: select.value });
    const elem = document.getElementById(compid)?.parentElement;
    if (elem)
      jQuery(elem.querySelectorAll('.update_url a, a.update_url')).fadeTo(1, 0).fadeTo(1000, 1);
  }

  const options = data
    ? data.items.map((d, i) => (
        <option key={optionKey(d)} value={i.toString()}>
          {optionText(Array.isArray(d) ? d[0] : d, true)}
        </option>
      ))
    : [];

  return (
    <Menulist onChange={onChange} {...(state as any)}>
      {options}
    </Menulist>
  );
}

function optionKey(data: string | FileItem | FileItem[]): string {
  if (data && typeof data === 'string') return randomID();
  const d = (Array.isArray(data) ? data : [data]) as FileItem[];
  const id = d
    .map((x) => x.relurl)
    .filter(Boolean)
    .join(', ');
  return id || randomID();
}

function optionText(data: string | FileItem, isMenulistText: boolean): string {
  if (typeof data === 'string') return data;
  return getEBookTitle(data, isMenulistText);
}

// Return eBook link text and menulist text.
function getEBookTitle(data: FileItem, menu: boolean): string {
  const { name, types, scope, full } = data;
  const Book = G.Book(G.i18n.language);

  if (full)
    return menu ? G.i18n.t('Full publication', { ns: 'widgets' }) : name;

  const books =
    scope?.replace(/[^-\s_]+/g, (m) =>
      m in Book ? (Book as any)[m].name : m,
    ) ?? '';
  const prefixes = [books, ...(types ? types : [])].filter(Boolean);
  const prefix = prefixes?.length ? prefixes.join(', ') : '';

  if (!prefix) return name;

  return menu ? prefix : `${prefix}: ${name}`;
}
