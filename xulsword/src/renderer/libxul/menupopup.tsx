/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { Vbox } from './boxes';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulStyle,
} from './xul';
import './xul.css';

// XUL menupopup
const defaultProps = {
  ...xulDefaultProps,
  onPopupShowing: null,
};

const propTypes = {
  ...xulPropTypes,
  onPopupShowing: PropTypes.func,
};

interface MenupopupProps extends XulProps {
  onPopupShowing?: (e: React.SyntheticEvent) => void | null;
}

class Menupopup extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: MenupopupProps) {
    super(props);
    this.state = {
      isOpen: false,
    };
  }

  render() {
    return (
      <Vbox {...this.props} className={xulClass('menupopup', this.props)}>
        {this.props.children}
      </Vbox>
    );
  }
}
Menupopup.defaultProps = defaultProps;
Menupopup.propTypes = propTypes;

export default Menupopup;
