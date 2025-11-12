import React, { useEffect, useState } from 'react';
import { randomID } from '../../../common.ts';
import log from '../../log.ts';
import { GI } from '../../G.ts';
import { functionalComponentRenderPromise } from '../../common.ts';
import RenderPromise from '../../renderPromise.ts';
import { Analytics } from '../../analytics.ts';
import Menulist from '../../components/libxul/menulist.tsx';
import { getProps } from '../common.ts';

import type { ChangeEvent, ReactNode } from 'react';
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
      value: data.items.findIndex((d) => 'option' in d),
    });
  });

  useEffect(() => {
    const { value } = state;
    // The MenuList values are always numbers, but will accept strings from
    // Drupal data.
    const index = Number.isNaN(Number(value)) ? 0 : Number(value);
    if (actions && data) {
      const { urlroot, items } = data;
      actions.forEach((action) => {
        switch (action) {
          case 'update_url': {
            const item = items[index];
            const option = 'option' in item ? item.option : null;
            const elem = document.getElementById(compid)?.parentElement;
            if (elem && option && typeof option !== 'string') {
              const links = Array.isArray(option) ? option : [option];
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
                  Analytics.addInfo(
                    {
                      event: 'download',
                      mid,
                    },
                    anchor,
                  );
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

  type DataItem = (typeof data.items)[number] & { dataItemIndex: number };
  function getElement(d: DataItem): ReactNode {
    const { dataItemIndex } = d;
    if ('option' in d) {
      const { option } = d;
      return (
        <option key={randomID()} value={dataItemIndex}>
          {optionText(
            Array.isArray(option) ? option[0] : option,
            true,
            renderPromise,
          )}
        </option>
      );
    } else if ('optgroup' in d) {
      const { optgroup, children } = d as {
        dataItemIndex: number;
        optgroup: string;
        children: DataItem[];
      };
      return (
        <optgroup key={randomID()} label={optgroup}>
          {children.map((op) => getElement(op))}
        </optgroup>
      );
    }
    // React warns about support for hr in select, so remove for now:
    // return <hr key={key} className={d.hr} />;
    return null;
  }

  // The optgroup item is just a string but needs to be a container now, so
  // reduce the data array, converting optgroups to containers with children.
  const options = data
    ? (data.items as DataItem[])
        .map((d, i) => {
          d.dataItemIndex = i;
          return d;
        })
        .reduce((p, c) => {
          const pl = p.at(-1);
          if (pl && 'optgroup' in pl && 'option' in c)
            (pl as any).children.push(c);
          else p.push(c);
          if ('optgroup' in c) (c as any).children = [];
          return p;
        }, [] as DataItem[])
        .map((d) => getElement(d))
        .filter(Boolean)
    : [];

  return (
    <Menulist onChange={onChange} {...(state as any)} domref={loadingRef}>
      {options}
    </Menulist>
  );
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
