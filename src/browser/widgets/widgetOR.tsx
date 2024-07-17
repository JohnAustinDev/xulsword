import React, { useState } from 'react';
import { handleAction, getProps } from '../bcommon.ts';
import SelectOR from '../../renderer/libxul/selectOR.tsx';

import type { ChaplistORType } from '../bcommon.ts';
import type {
  SelectORMType,
  SelectORProps,
} from '../../renderer/libxul/selectOR.tsx';

// A React component widget for selection from an arbitrary hierarchical
// node set, such as a SWORD General Book table of contents.

export type WidgetORProps = {
  compid: string;
  initial: Partial<SelectORProps>;
  chaplist?: ChaplistORType;
  action?: string;
};

export type WidgetORState = Omit<SelectORProps, 'onSelection'>;

export default function WidgetOR(props: WidgetORProps): React.JSX.Element {
  const { compid, initial } = props;

  const onSelectOR = (selection?: SelectORMType): void => {
    const { action, chaplist } = props;
    if (action) handleAction(action, compid, selection, chaplist);
  };

  const [state] = useState(() => {
    return getProps(initial, {
      initialORM: { otherMod: 'genbk', keys: [] },
      nodeLists: [],
      otherMods: [],
      disabled: false,
      enableMultipleSelection: false,
      enableParentSelection: false,
    }) as WidgetORState;
  });

  return <SelectOR onSelection={onSelectOR} {...(state as WidgetORState)} />;
}
