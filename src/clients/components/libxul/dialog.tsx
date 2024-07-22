import React, { type ReactElement } from 'react';
import PropTypes from 'prop-types';
import { Classes, Dialog as BPDialog } from '@blueprintjs/core';
import { drop } from '../../../common.ts';
import { xulPropTypes, type XulProps } from './xul.tsx';
import { Hbox } from './boxes.tsx';

// XUL label
const propTypes = {
  ...xulPropTypes,
  body: PropTypes.element,
  buttons: PropTypes.element,
};

type DialogProps = {
  body?: ReactElement | null;
  buttons?: ReactElement | null;
} & XulProps;

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
Dialog.propTypes = propTypes;

export default Dialog;
