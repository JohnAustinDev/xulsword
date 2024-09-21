import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import { getLangReadable } from '../../common.ts';
import RenderPromise from '../../renderPromise.ts';
import { addClass, xulPropTypes, type XulProps } from './xul.tsx';
import Menulist from './menulist.tsx';

import type { ModTypes } from '../../../type.ts';

// This ModuleMenu component does not keep its own selection state so it
// requires that an onChange handler function prop is provided.

const propTypes = {
  ...xulPropTypes,
  value: PropTypes.string,
  description: PropTypes.bool,
  disabled: PropTypes.bool,
  allowNotInstalled: PropTypes.bool,
  modules: PropTypes.arrayOf(PropTypes.string),
  types: PropTypes.arrayOf(PropTypes.string),
};

type ModuleMenuProps = {
  value: string;
  language?: boolean; // show language or not
  description?: boolean; // show description as tooltip or not
  disabled?: boolean;
  allowNotInstalled?: boolean;
  modules?: string[]; // show only these modules or all if []
  types?: ModTypes[]; // show only these types or all if []
  onChange: (e: any) => void | Promise<void>;
} & XulProps;

export default function ModuleMenu({
  language = false,
  description = false,
  disabled = false,
  allowNotInstalled = false,
  modules = [],
  types = [],
  ...props
}: ModuleMenuProps) {
  const [, setStateRP] = useState(0);
  const [renderPromise] = useState(
    () => new RenderPromise(() => setStateRP((prevState) => prevState + 1)),
  );
  useEffect(() => renderPromise.dispatch());
  const mtabs = modules.length
    ? modules.filter((m) => m in G.Tab).map((m) => G.Tab[m])
    : G.Tabs;

  const notInstalled = modules.filter((m) => !(m in G.Tab));

  return (
    <Menulist {...addClass('modulemenu', { disabled, ...props })}>
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
                    let { label } = tab;
                    if (language && tab.conf.Lang) {
                      label = `${getLangReadable(tab.conf.Lang, renderPromise)}: ${label}`;
                    }
                    return (
                      <option
                        className={tab.labelClass}
                        key={[tab.module].join('.')}
                        value={tab.module}
                        title={
                          description && tab.conf.Description
                            ? tab.conf.Description.locale
                            : ''
                        }
                      >
                        {label}
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
