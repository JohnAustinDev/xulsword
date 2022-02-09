/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { XulProps } from './xul';
import './xul.css';
import './tooltip.css';

// Tooltip called by other XUL elements
const defaultProps = { tip: undefined };

const propTypes = { tip: PropTypes.string };

interface TooltipProps extends XulProps {
  tip: string | undefined;
}

function Tooltip(props: TooltipProps) {
  if (!props.tip || typeof props.tip !== 'string') return null;
  return <span className="tooltiptext">{props.tip}</span>;
}
Tooltip.defaultProps = defaultProps;
Tooltip.propTypes = propTypes;

export default Tooltip;