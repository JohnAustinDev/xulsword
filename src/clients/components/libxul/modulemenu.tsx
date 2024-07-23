import React from 'react';
import PropTypes from 'prop-types';
import C from '../../../constant.ts';
import { G } from '../../G.ts';
import { addClass, xulPropTypes, type XulProps } from './xul.tsx';
import Menulist from './menulist.tsx';

import type { ModTypes } from '../../../type.ts';

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
  description?: boolean; // show description or not
  disabled?: boolean;
  allowNotInstalled?: boolean;
  modules?: string[]; // show only these modules or all if []
  types?: ModTypes[]; // show only these types or all if []
  onChange: (e: any) => void | Promise<void>;
} & XulProps;

export default function ModuleMenu({
  description = false,
  disabled = false,
  allowNotInstalled = false,
  modules = [],
  types = [],
  ...props
}: ModuleMenuProps) {
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
                    if (description && tab.conf.Description)
                      label += ` ${tab.conf.Description.locale}`;
                    return (
                      <option
                        className={tab.labelClass}
                        key={[tab.module].join('.')}
                        value={tab.module}
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
