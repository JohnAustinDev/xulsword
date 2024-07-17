import React, { useEffect, useState } from 'react';
import { handleAction, getProps, optionKey, optionText } from '../bcommon.ts';
import { clone } from '../../common.ts';
import Menulist from '../../renderer/libxul/menulist.tsx';

import type { ChangeEvent } from 'react';
import type { SelectData } from '../bcommon.ts';
import type { MenulistProps } from '../../renderer/libxul/menulist.tsx';

// A React component widget for selection from a set of options.

export type WidgetMenulistProps = {
  compid: string;
  initial: Partial<WidgetMenulistState>;
  data?: SelectData;
  action?: string;
};

export type WidgetMenulistState = Omit<MenulistProps, 'onChange'>;

export default function WidgetMenulist(
  props: WidgetMenulistProps,
): React.JSX.Element {
  const { initial, data, action, compid } = props;

  // Although this value is a number, MenuList expects a string.
  const { value } = initial;
  if (Number.isInteger(value)) initial.value = value?.toString();

  const onChange = (
    e: React.SyntheticEvent<HTMLSelectElement, ChangeEvent>,
  ): void => {
    const select = e.target as HTMLSelectElement;
    setState((prevState: Partial<WidgetMenulistState>) => {
      const newState = clone(prevState);
      newState.value = select.value;
      return newState;
    });
    jQuery(`#${compid}`).prev().fadeTo(1, 0).fadeTo(1000, 1);
  };

  const [state, setState] = useState(() => {
    return getProps(initial, {
      disabled: false,
      multiple: false,
      value: '0',
    });
  });

  useEffect(() => {
    const { value } = state;
    const index = value && typeof value === 'string' ? Number(value) || 0 : 0;
    if (data) {
      const { title, base, items } = data;
      if (action && data)
        handleAction(action, compid, title, base, items, index);
    }
  }, [state.value]);

  const options = data
    ? data.items.map((d, i) => (
        <option key={optionKey(d)} value={i.toString()}>
          {optionText(d, false, data.title)}
        </option>
      ))
    : [];

  return (
    <Menulist onChange={onChange} {...(state as any)}>
      {options}
    </Menulist>
  );
}
