import React from 'react';
import PropTypes from 'prop-types';
import C from '../../../constant.ts';
import { G } from '../../G.ts';
import {
  functionalComponentRenderPromise,
  getLangReadable,
} from '../../common.tsx';
import { addClass, xulPropTypes, type XulProps } from './xul.tsx';
import Menulist from './menulist.tsx';

import type { ModTypes, TabType } from '../../../type.ts';

// The ModuleMenu component does not keep its own selection state so it
// requires that an onChange handler function prop be provided.

const propTypes = {
  ...xulPropTypes,
  value: PropTypes.string,
  language: PropTypes.bool,
  description: PropTypes.bool,
  sortByLabel: PropTypes.bool,
  disabled: PropTypes.bool,
  allowNotInstalled: PropTypes.bool,
  modules: PropTypes.arrayOf(PropTypes.string),
  types: PropTypes.arrayOf(PropTypes.string),
};

type ModuleMenuProps = {
  value: string;
  language?: boolean; // show language or not
  description?: boolean; // show description as tooltip or not
  sortByLabel?: boolean; // sort options alphabetically by label
  disabled?: boolean;
  allowNotInstalled?: boolean;
  modules?: string[]; // show only these modules or all if []
  types?: ModTypes[]; // show only these types or all if []
  onChange: (e: any) => void | Promise<void>;
} & XulProps;

export default function ModuleMenu({
  language = false,
  description = false,
  sortByLabel = true,
  disabled = false,
  allowNotInstalled = false,
  modules = [],
  types = [],
  ...props
}: ModuleMenuProps) {
  const { renderPromise, loadingRef } = functionalComponentRenderPromise();

  let mtabs: TabType[];
  let notInstalled: string[] = [];
  if (modules.length) {
    mtabs = modules.filter((m) => m in G.Tab).map((m) => G.Tab[m]);
    notInstalled = modules.filter((m) => !(m in G.Tab));
  } else {
    mtabs = [...G.Tabs];
  }

  const labels: Record<string, string> = {};
  mtabs.forEach((t) => {
    labels[t.module] = t.label;
    if (language && t.lang) {
      labels[t.module] =
        `${getLangReadable(t.lang, renderPromise)}: ${labels[t.module]}`;
    }
  });

  if (sortByLabel) {
    mtabs.sort((a, b) => labels[a.module].localeCompare(labels[b.module]));
    notInstalled.sort();
  }

  return (
    <Menulist
      domref={loadingRef}
      {...addClass('modulemenu', { disabled, ...props })}
    >
      {allowNotInstalled &&
        notInstalled.map((m) => (
          <option className={`cs-${m}`} key={[m].join('.')} value={m}>
            {m}
          </option>
        ))}
      {Object.keys(C.SupportedTabTypes).map((typ) => {
        const type = typ as ModTypes;
        if (
          (!types.length || types.includes(type)) &&
          mtabs.some((tab) => tab.type === type)
        )
          return (
            <optgroup
              key={[type].join('.')}
              label={G.i18n.t(C.SupportedTabTypes[type])}
            >
              {mtabs
                .map((tab) => {
                  if (tab.type === type) {
                    return (
                      <option
                        key={[tab.module].join('.')}
                        value={tab.module}
                        title={
                          description && tab.description
                            ? tab.description.locale
                            : ''
                        }
                      >
                        {labels[tab.module]}
                      </option>
                    );
                  }
                  return null;
                })
                .filter(Boolean)}
            </optgroup>
          );
        return null;
      })}
    </Menulist>
  );
}
ModuleMenu.propTypes = propTypes;
