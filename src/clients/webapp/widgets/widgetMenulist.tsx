import React, { useEffect, useState } from 'react';
import { randomID } from '../../../common.ts';
import log from '../../log.ts';
import { G, GI } from '../../G.ts';
import { functionalComponentRenderPromise } from '../../common.ts';
import RenderPromise from '../../renderPromise.ts';
import { Analytics } from '../../analytics.ts';
import Menulist from '../../components/libxul/menulist.tsx';
import { getProps } from '../common.ts';

import type { ChangeEvent } from 'react';
import type { AnalyticsInfo } from '../../analytics.ts';
import type { MenulistProps } from '../../components/libxul/menulist.tsx';
import type { FileItem, WidgetMenulistData } from './defaultSettings.ts';

// A React component widget for selection from a set of options, such as a set
// of eBook files.

export type WidgetMenulistProps = {
  compid: string;
  settings: WidgetMenulistData;
};

export type WidgetMenulistState = Omit<MenulistProps, 'onChange'>;

export default function WidgetMenulist(
  wprops: WidgetMenulistProps,
): React.JSX.Element {
  const { compid, settings } = wprops;
  const { actions: actions, props, data } = settings;

  const { renderPromise, loadingRef } = functionalComponentRenderPromise();
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
    if (actions && data) {
      const { urlroot, items } = data;
      actions.forEach((action) => {
        switch (action) {
          case 'update_url': {
            const item = items[index];
            const elem = document.getElementById(compid)?.parentElement;
            if (elem && typeof item !== 'string') {
              const links = Array.isArray(item) ? item : [item];
              const a = Array.from(
                elem.querySelectorAll('.update_url a, a.update_url'),
              );
              links.forEach((link, x) => {
                const { relurl, size, mid } = link;
                const anchor = a[x] as HTMLElement;
                if (anchor && relurl) {
                  const root = urlroot.replace(/\/$/, '');
                  const rel = relurl.replace(/^\//, '');
                  anchor.setAttribute('href', `${root}/${rel}`);
                  anchor.textContent = optionText(link, false, renderPromise);
                  const info: AnalyticsInfo = {
                    event: 'download',
                    mid,
                  };
                  Analytics.addInfo(info, anchor);
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
            break;
          }
          default: {
            log.error(`Unknown selectMenulist action: '${actions}'`);
          }
        }
      });
    }
  }, [state.value]);

  function onChange(
    e: React.SyntheticEvent<HTMLSelectElement, ChangeEvent>,
  ): void {
    const select = e.target as HTMLSelectElement;
    setState({ value: select.value });
    const elem = document.getElementById(compid)?.parentElement;
    if (elem)
      jQuery(elem.querySelectorAll('.update_url a, a.update_url'))
        .fadeTo(1, 0)
        .fadeTo(1000, 1);
  }

  const options = data
    ? data.items.map((d, i) => (
        <option key={optionKey(d)} value={i.toString()}>
          {optionText(Array.isArray(d) ? d[0] : d, true, renderPromise)}
        </option>
      ))
    : [];

  return (
    <Menulist onChange={onChange} {...(state as any)} domref={loadingRef}>
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

function optionText(
  data: string | FileItem,
  isMenulistText: boolean,
  renderPromise: RenderPromise,
): string {
  if (typeof data === 'string') return data;
  return getEBookTitle(data, isMenulistText, renderPromise);
}

// Return eBook link text and menulist text.
function getEBookTitle(
  data: FileItem,
  menu: boolean,
  renderPromise: RenderPromise,
): string {
  const { ntitle, full, label } = data;
  if (full)
    return menu
      ? GI.i18n.t('', renderPromise, 'Full publication', { ns: 'widgets' })
      : ntitle;

  if (label) return menu ? label : `${label}: ${ntitle}`;

  return ntitle;
}
