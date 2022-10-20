/* eslint-disable react/prefer-stateless-function */
/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import i18n from 'i18next';
import PropTypes from 'prop-types';
import C from '../../constant';
import G from '../rg';
import { addClass, xulDefaultProps, xulPropTypes, XulProps } from './xul';
import Menulist from './menulist';

import type { ModTypes } from '../../type';

const defaultProps = {
  ...xulDefaultProps,
  value: '',
  description: false,
  disabled: false,
  modules: [],
  types: [],
};

const propTypes = {
  ...xulPropTypes,
  value: PropTypes.string,
  description: PropTypes.bool,
  disabled: PropTypes.bool,
  modules: PropTypes.arrayOf(PropTypes.string),
  types: PropTypes.arrayOf(PropTypes.string),
};

interface ModuleMenuProps extends XulProps {
  value: string;
  description: boolean; // show description or not
  disabled: boolean;
  modules: string[]; // show only these modules or all if []
  types: ModTypes[]; // show only these types or all if []
}

class ModuleMenu extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  render() {
    const props = this.props as ModuleMenuProps;
    const { description, modules, types } = props;

    const mtabs = modules.length
      ? modules.filter((m) => m in G.Tab).map((m) => G.Tab[m])
      : G.Tabs;

    return (
      <Menulist {...addClass('modulemenu', props)}>
        {Object.keys(C.SupportedModuleTypes).map((typ) => {
          const type = typ as ModTypes;
          if (
            (!types.length || types.includes(type)) &&
            mtabs.some((tab) => tab.type === type)
          )
            return (
              <optgroup key={type} label={i18n.t(C.SupportedModuleTypes[type])}>
                {mtabs
                  .map((tab) => {
                    if (tab.type === type) {
                      let { label } = tab;
                      if (description && tab.description)
                        label += ` ${tab.description}`;
                      return (
                        <option
                          className={tab.labelClass}
                          key={tab.module}
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
