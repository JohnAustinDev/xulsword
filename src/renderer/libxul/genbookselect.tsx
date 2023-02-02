/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable no-nested-ternary */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import type { TreeNodeInfo } from '@blueprintjs/core';
import { clone, diff, genBookTreeNodes } from '../../common';
import C from '../../constant';
import G from '../rg';
import log from '../log';
import { addClass, xulDefaultProps, XulProps, xulPropTypes } from './xul';
import { Vbox } from './boxes';
import Menulist from './menulist';
import './genbookselect.css';

// Allow users to select one or more chapters from any SWORD General-Book
// parent node.

export type SelectGBMType = {
  gbmod: string;
  parent: string;
  children: string[];
};

export type GBModNodeList = {
  module: string;
  label: string;
  labelClass: string;
  nodes: TreeNodeInfo[];
};

// The GBSelect can either keep its own state OR work as a controlled
// component. Properties of the initial prop that are undefined are
// controlled by the corresponding select prop and internal state is
// ignored, meaning the onSelection callback must be used to control
// the select prop of the component. Properties of the initial prop that
// are set will have their state kept withinin the component and any
// corresponding select prop will be ignored.
//
// The gbmods prop is an array of INSTALLED GenBooks to select from. If
// left undefined, all installed GenBooks will be available.
//
// The gbmodNodeLists prop is a list of GenBook mods which need NOT BE
// INSTALLED but the name and node list must be provided as GBModNodeList[].
export interface GBSelectProps extends XulProps {
  initialGBM?: Partial<SelectGBMType>;
  selectGBM?: Partial<SelectGBMType>;
  gbmods?: string[];
  gbmodNodeLists?: GBModNodeList[];
  enableMultipleSelection?: boolean;
  disabled?: boolean;
  onSelection?: (selection: SelectGBMType, id?: string) => void;
}

const defaultProps = {
  ...xulDefaultProps,
  initialGBM: undefined,
  selectGBM: undefined,
  gbmods: undefined,
  gbmodNodeLists: undefined,
  enableMultipleSelection: false,
  disabled: undefined,
  onSelection: undefined,
};

const propTypes = {
  ...xulPropTypes,
  initialGBM: PropTypes.object,
  selectGBM: PropTypes.object,
  gbmods: PropTypes.arrayOf(PropTypes.string),
  gbmodNodeLists: PropTypes.arrayOf(PropTypes.object),
  enableMultipleSelection: PropTypes.bool,
  disabled: PropTypes.bool,
  onSelection: PropTypes.func,
};

interface GBSelectState {
  stateGBM: SelectGBMType;
}

class GBSelect extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  prevValues: SelectGBMType;

  constructor(props: GBSelectProps) {
    super(props);
    const { initialGBM, gbmods, gbmodNodeLists } = props;
    const defaultGBM = {
      gbmod:
        (gbmods && gbmods[0]) ||
        (gbmodNodeLists && gbmodNodeLists[0].module) ||
        G.Tabs.find((t) => t.type === C.GENBOOK)?.module ||
        '',
      parent: '',
      children: [],
    };
    const s: GBSelectState = {
      stateGBM: {
        ...defaultGBM,
        ...initialGBM,
      },
    };
    this.state = s;

    this.prevValues = s.stateGBM;

    this.handler = this.handler.bind(this);
  }

  componentDidMount(): void {
    const state = this.state as GBSelectState;
    const { stateGBM } = state;
    const { prevValues } = this;

    // Insure state contains initial select values
    if (diff(stateGBM, prevValues)) {
      this.setState({ stateGBM: prevValues });
    }
  }

  handler(ev: React.SyntheticEvent) {
    const props = this.props as GBSelectProps;
    switch (ev.type) {
      case 'change': {
        const e = ev as React.ChangeEvent<HTMLSelectElement>;
        const { onSelection } = props;
        const m = e.currentTarget.className.match(
          /\b(key-(\d+)|module|children)\b/
        );
        if (m) {
          const [, cls, ix] = m;
          const i = Number(ix);
          this.setState((prevState: GBSelectState) => {
            const { stateGBM: s } = clone(prevState);
            let stateGBM = s;
            if (cls === 'module') {
              stateGBM = {
                gbmod: e.target.value,
                parent: '',
                children: [],
              };
            } else if (cls === 'children') {
              stateGBM.children = Array.from(e.target.selectedOptions).map(
                (o) => o.value
              );
            } else {
              const p = stateGBM.parent.split(C.GBKSEP).slice(0, i);
              p.push(e.target.value);
              p.push(''); // add trailing GBSEP
              stateGBM.parent = p.join(C.GBKSEP);
              stateGBM.children = [];
            }
            if (onSelection) onSelection(stateGBM, props.id);
            return { stateGBM };
          });
        }

        break;
      }
      default:
        throw new Error(`Unhandled genbookselect event type ${ev.type}`);
    }
  }

  render() {
    const props = this.props as GBSelectProps;
    const state = this.state as GBSelectState;
    const {
      selectGBM,
      initialGBM,
      gbmods: gbmodsProp,
      gbmodNodeLists,
      enableMultipleSelection,
    } = props;
    const { stateGBM } = state;
    const { handler } = this;

    // Use the selectGBM child prop if initialGBM child prop is not defined.
    // Otherwise, use the stateGBM prop.
    const selection = stateGBM;
    const checkProps = [
      'gbmod',
      'parent',
      'children',
    ] as (keyof GBSelectState['stateGBM'])[];
    checkProps.forEach((p) => {
      if (!(initialGBM && p in initialGBM)) {
        if (selectGBM && p in selectGBM) selection[p] = selectGBM[p] as any;
        else
          log.warn(
            `GBSelect selectGBM.${p} and initialGBM.${p} are both undefined.`
          );
      }
    });
    const { gbmod, parent: parentx, children: childrenx } = selection;

    // Get modules to be made available for selection, and their node lists:
    const gbms =
      gbmodsProp && !gbmodsProp.length
        ? []
        : gbmodsProp || G.Tabs.map((t) => t.module);
    const gbmods = gbms.filter(
      (m) => m && m in G.Tab && G.Tab[m].type === C.GENBOOK
    );
    const list: GBModNodeList[] = gbmods.map((m) => {
      return {
        module: m,
        label: G.Tab[m].label,
        labelClass: G.Tab[m].labelClass,
        nodes: genBookTreeNodes(G.LibSword.getGenBookTableOfContents(m), m),
      };
    });
    if (gbmodNodeLists) list.push(...gbmodNodeLists);

    // Insure selectors are shown even when there is no selection.
    let parent = parentx;
    let children = childrenx;
    if (!parent) {
      const nlist = list.find((l) => l.module === gbmod);
      if (nlist) {
        const p = nlist.nodes[0];
        if (p) {
          parent = p.id.toString();
          children = [];
        }
      }
    }
    if (!children.length) {
      const nlist = list.find((l) => l.module === gbmod);
      if (nlist) {
        const p = nlist.nodes.find((n) => n.id === parent);
        if (p) {
          children = p.childNodes?.map((n) => n.id.toString()) || [];
        }
      }
    }

    // Generate all HTML select elements
    const selects: JSX.Element[] = [];
    // Module selector
    this.prevValues.gbmod = gbmod;
    selects.push(
      <Menulist
        className="module"
        key={['mod'].join('.')}
        value={gbmod}
        disabled={gbmod === list[0].module && list.length === 1}
        onChange={handler}
      >
        {list.map((x) => (
          <option
            key={['modo', x.module, x.labelClass, x.label].join('.')}
            className={x.labelClass}
            value={x.module}
          >
            {x.label}
          </option>
        ))}
      </Menulist>
    );
    // Parent selectors
    const parentid = parent;
    if (gbmod) {
      const nlist = list.find((l) => l.module === gbmod);
      if (nlist) {
        this.prevValues.parent = parent;
        selects.push(
          ...parentid
            .split(C.GBKSEP)
            .filter((p, i, a) => i !== a.length - 1 || p)
            .map((k, i, a) => (
              <Menulist
                className={`key-${i}`}
                key={['key'].concat(a.slice(0, i + 1)).join('.')}
                value={k || undefined}
                onChange={handler}
              >
                {nlist.nodes
                  .filter((n) => {
                    const level = a.length;
                    const nlevel = n.id
                      .toString()
                      .split(C.GBKSEP)
                      .filter(
                        (px, ix, ax) => ix !== ax.length - 1 || px
                      ).length;
                    return nlevel === level;
                  })
                  .map((n) => {
                    const idp = n.id.toString().split(C.GBKSEP);
                    idp.pop(); // remove undefined
                    const id = idp.pop();
                    const label = n.label.toString();
                    const className = !Number.isNaN(Number(label))
                      ? undefined
                      : `cs-${gbmod}`;
                    return (
                      <option
                        key={['keyo', className, label].join('.')}
                        className={className}
                        value={id}
                      >
                        {label}
                      </option>
                    );
                  })}
              </Menulist>
            ))
        );
        // Child selector
        const parentNode = nlist.nodes.find((n) => n.id && n.id === parent);
        if (parentNode?.childNodes?.length) {
          this.prevValues.children = children;
          const value = enableMultipleSelection ? children : children[0];
          selects.push(
            <Menulist
              className="children"
              key={['ch'].join('.')}
              multiple={!!enableMultipleSelection}
              value={value}
              onChange={handler}
            >
              {parentNode.childNodes.map((n) => {
                const idp = n.id.toString().split(C.GBKSEP);
                const label = idp.pop();
                const className = !Number.isNaN(Number(label))
                  ? undefined
                  : `cs-${gbmod}`;
                return (
                  <option
                    key={['cho', className, label].join('.')}
                    className={className}
                    value={label}
                  >
                    {label}
                  </option>
                );
              })}
            </Menulist>
          );
        }
      }
    }

    return (
      <Vbox {...addClass('gbselect', this.props)} pack="start" align="start">
        {selects}
      </Vbox>
    );
  }
}
GBSelect.defaultProps = defaultProps;
GBSelect.propTypes = propTypes;

export default GBSelect;
