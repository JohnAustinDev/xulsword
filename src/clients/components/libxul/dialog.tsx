import React, { type ReactElement } from 'react';
import { Classes, Dialog as BPDialog } from '@blueprintjs/core';
import { drop } from '../../../common.ts';
import { Hbox } from './boxes.tsx';

import type { XulProps } from './xul.tsx';

// XUL label
type DialogProps = {
  body?: ReactElement | null;
  buttons?: ReactElement | null;
} & XulProps;

export default function Dialog(props: DialogProps) {
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
