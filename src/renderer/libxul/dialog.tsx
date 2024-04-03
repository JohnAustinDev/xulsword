/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React, { ReactElement } from 'react';
import PropTypes from 'prop-types';
import { Classes, Dialog as BPDialog } from '@blueprintjs/core';
import { drop } from '../../common.ts';
import { xulDefaultProps, xulPropTypes, XulProps } from './xul.tsx';
import { Hbox } from './boxes.tsx';

// XUL label
const defaultProps = {
  ...xulDefaultProps,
  body: null,
  buttons: null,
};

const propTypes = {
  ...xulPropTypes,
  body: PropTypes.element,
  buttons: PropTypes.element,
};

interface DialogProps extends XulProps {
  body: ReactElement | null;
  buttons: ReactElement | null;
}

function Dialog(props: DialogProps) {
  const { body, buttons, className } = props;
  const cls = ['dialog'];
  if (className) cls.push(className);
  return (
    <BPDialog className={cls.join(' ')} isOpen>
      <div className={`dialog-body ${Classes.DIALOG_BODY}`}>{body}</div>
      <Hbox pack="end" align="center" {...drop(props, ['className'])}>
        {buttons}
      </Hbox>
    </BPDialog>
  );
}
Dialog.defaultProps = defaultProps;
Dialog.propTypes = propTypes;

export default Dialog;
