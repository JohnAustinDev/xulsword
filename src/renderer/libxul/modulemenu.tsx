/* eslint-disable react/prefer-stateless-function */
/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import C from '../../constant.ts';
import G from '../rg.ts';
import { addClass, xulDefaultProps, xulPropTypes, XulProps } from './xul.tsx';
import Menulist from './menulist.tsx';

import type { ModTypes } from '../../type.ts';

const defaultProps = {
  ...xulDefaultProps,
  value: '',
  description: false,
  disabled: false,
  allowNotInstalled: false,
  modules: [],
  types: [],
};

const propTypes = {
  ...xulPropTypes,
  value: PropTypes.string,
  description: PropTypes.bool,
  disabled: PropTypes.bool,
  allowNotInstalled: PropTypes.bool,
  modules: PropTypes.arrayOf(PropTypes.string),
  types: PropTypes.arrayOf(PropTypes.string),
};

interface ModuleMenuProps extends XulProps {
  value: string;
  description: boolean; // show description or not
  disabled: boolean;
  allowNotInstalled: boolean;
  modules: string[]; // show only these modules or all if []
  types: ModTypes[]; // show only these types or all if []
}

class ModuleMenu extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  render() {
    const props = this.props as ModuleMenuProps;
    const { description, modules, types, allowNotInstalled } = props;

    const mtabs = modules.length
      ? modules.filter((m) => m in G.Tab).map((m) => G.Tab[m])
      : G.Tabs;

    const notInstalled = modules.filter((m) => !(m in G.Tab));

    return (
      <Menulist {...addClass('modulemenu', props)}>
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
}
ModuleMenu.defaultProps = defaultProps;
ModuleMenu.propTypes = propTypes;

export default ModuleMenu;
