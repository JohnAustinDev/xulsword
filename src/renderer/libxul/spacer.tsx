/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { xulPropTypes, type XulProps, htmlAttribs } from './xul.tsx';
import { Box } from './boxes.tsx';

// XUL spacer
const propTypes = {
  ...xulPropTypes,
  // eslint-disable-next-line react/no-unused-prop-types
  orient: PropTypes.oneOf(['horizontal', 'vertical']),
};

type SpacerProps = XulProps & {
  orient?: 'horizontal' | 'vertical';
};

function Spacer({ orient = 'horizontal', ...props }: SpacerProps) {
  return (
    <Box {...htmlAttribs('spacer', { orient, ...props })}>{props.children}</Box>
  );
}
Spacer.propTypes = propTypes;

export default Spacer;
