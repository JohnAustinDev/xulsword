import React, { useEffect, useState } from 'react';
import { diff, randomID } from '../../../common.ts';
import log from '../../log.ts';
import { functionalComponentRenderPromise } from '../../common.ts';
import { Analytics } from '../../analytics.ts';
import Menulist from '../../components/libxul/menulist.tsx';
import { delayHandler } from '../../components/libxul/xul.tsx';
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

let OwlBugFix: number; // Setting owl carousel to the current value breaks it.
let currentIndex: number;

export default function WidgetMenulist(
  wprops: WidgetMenulistProps,
): React.JSX.Element {
  const { compid, settings } = wprops;
  const { actions, autodownload, props, data } = settings;
  // eslint-disable-next-line react/prop-types
  const { value } = props;

  const { renderPromise, loadingRef } = functionalComponentRenderPromise();
  currentIndex = !Number.isNaN(Number(value))
    ? Number(value)
    : data.items.findIndex((d) => 'option' in d);
  const [state, setState] = useState(() => {
    return getProps(props, {
      disabled: false,
      multiple: false,
      value: currentIndex,
    });
  });

  // Component state may be controlled externally by using this:
  if (!('setMenulistWidgetState' in globalThis))
    globalThis.setMenulistWidgetState = {};
  globalThis.setMenulistWidgetState[compid] = (newState) => {
    if (diff(state, newState)) {
      animateWidget(compid, false);
      setState(newState);
    }
  };

  useEffect(() => {
    const { value } = state;
    const { urlroot, items } = data;
    // The MenuList values are always numbers, but will accept strings from
    // Drupal data.
    const index = Number.isNaN(Number(value)) ? 0 : Number(value);
    const item = items[index];
    const selOption = 'option' in item ? item.option : null;
    if (actions && data && selOption && typeof selOption !== 'string') {
      actions.forEach((action) => {
        switch (action) {
          case 'update_url': {
            const elem = document.getElementById(compid)?.parentElement;
            if (elem) {
              const [anchor] = Array.from(
                elem.querySelectorAll('.update_url a, a.update_url'),
              ) as HTMLElement[];
              const { updateUrlLabel, label, relurl, size, mid } = selOption;
              if (anchor && relurl) {
                const root = urlroot.replace(/\/$/, '');
                const rel = relurl.replace(/^\//, '');
                anchor.setAttribute('href', `${root}/${rel}`);
                anchor.textContent = updateUrlLabel ?? label;
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
                if (index !== currentIndex && autodownload) {
                  anchor.click();
                  currentIndex = index;
                }
              }
            }
            break;
          }
          case 'update_owl': {
            const owl = jQuery('.owl-carousel');
            if (owl) {
              const { owlIndex } = selOption;
              if (
                typeof owlIndex !== 'undefined' &&
                (typeof OwlBugFix === 'undefined' || owlIndex[0] !== OwlBugFix)
              ) {
                owl.trigger('to.owl.carousel', owlIndex);
                [OwlBugFix] = owlIndex;
              }
            }
            break;
          }
          default: {
            log.error(`Unknown selectMenulist action: '${actions}'`);
          }
        }
      });
    }
    animateWidget(compid, true);
  }, [state.value]);

  function onChange(
    e: React.SyntheticEvent<HTMLSelectElement, ChangeEvent>,
  ): void {
    const select = e.target as HTMLSelectElement;
    animateWidget(compid, false);
    setState({ value: select.value });
  }

  function animateWidget(compid: string, inOut = false) {
    const cto = `animate-${compid}`;
    const elem = document.getElementById(compid)?.parentElement;
    if (elem) {
      const jels = jQuery(elem.querySelectorAll('.update_url a, a.update_url'));
      if (inOut) {
        delayHandler(
          globalThis,
          (j) => {
            j.fadeTo(1000, 1);
            (globalThis as any)[cto] = null;
          },
          [jels],
          250,
          cto,
        );
      } else if (!(globalThis as any)[cto]) {
        jels.fadeTo(1, 0);
      }
    }
  }

  type IndexedDataItem = (typeof data.items)[number] & {
    dataItemIndex: number;
    children: IndexedDataItem[];
  };
  function getElement(d: IndexedDataItem): ReactNode {
    const { dataItemIndex } = d;
    if ('option' in d) {
      const { option } = d;
      return (
        <option key={randomID()} value={dataItemIndex}>
          {(option as FileItem).label}
        </option>
      );
    } else if ('optgroup' in d) {
      const { optgroup, children } = d;
      return (
        <optgroup key={randomID()} label={optgroup}>
          {children.map((d) => getElement(d))}
        </optgroup>
      );
    }
    // React warns about support for hr in select, so remove for now:
    // return <hr key={key} className={d.hr} />;
    return null;
  }

  // The optgroup item is just a string but needs to be a container for React,
  // so reduce the data array, converting optgroups to containers with
  // children. Also filter out hr until React supports them.
  return (
    <Menulist onChange={onChange} {...(state as any)} domref={loadingRef}>
      {(data.items as IndexedDataItem[])
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
        }, [] as IndexedDataItem[])
        .map((d) => getElement(d))
        .filter(Boolean)}
    </Menulist>
  );
}
