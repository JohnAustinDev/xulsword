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
import { genBookKeyNode, genBookTreeNodes } from '../../common';
import C from '../../constant';
import G from '../rg';
import { addClass, xulDefaultProps, XulProps, xulPropTypes } from './xul';
import { Hbox, Vbox } from './boxes';
import Label from './label';
import Menulist from './menulist';
import { TreeView } from './treeview';
import './genbookselect.css';

// Allow users to select one or more chapters from a General-Book SWORD module.

export type SelectGBMType = {
  gbmod: string;
  selectedKeys: (string | number)[];
  expandedKeys: (string | number)[];
};

// The GBSelect can either keep its own state OR work as a controlled
// component. Properties of the initial prop that are undefined are
// controlled by the corresponding select prop and no state is then
// kept, but the corresponding onchange callback must be used to control
// the component. Properties of the initial prop that are set will
// have their state kept withinin the component and any corresponding
// initial prop will be ignored.
//
// The gbmods prop is an array of INSTALLED GenBooks to select from. If
// left undefined, all installed GenBooks will be available.
//
// The gbmodNodeLists prop lists GenBook mods which may NOT BE INSTALLED
// but the name and node list is known.
export interface GBSelectProps extends XulProps {
  initialGBM?: Partial<SelectGBMType>;
  selectGBM?: Partial<SelectGBMType>;
  gbmods?: string[];
  gbmodNodeLists?: GBModNodeList[];
  enableMultipleSelection?: boolean;
  disabled?: boolean;
  onGbmodChange?: (gbmod: string) => void;
  onSelection?: (selection: (string | number)[]) => void;
  onExpansion?: (selection: (string | number)[]) => void;
}

const defaultProps = {
  ...xulDefaultProps,
  initialGBM: undefined,
  selectBGM: undefined,
  gbmods: undefined,
  gbmodNodeLists: undefined,
  enableMultipleSelection: false,
  disabled: undefined,
  onGbmodChange: undefined,
  onSelection: undefined,
  onExpansion: undefined,
};

const propTypes = {
  ...xulPropTypes,
  initialGBM: PropTypes.object,
  selectBGM: PropTypes.object,
  gbmods: PropTypes.arrayOf(PropTypes.string),
  gbmodNodeLists: PropTypes.object,
  enableMultipleSelection: PropTypes.bool,
  disabled: PropTypes.bool,
  onGbmodChange: PropTypes.func,
  onSelection: PropTypes.func,
  onExpansion: PropTypes.func,
};

interface GBSelectState {
  selectedMod: string;
  isOpen: boolean;
}

export type GBModNodeList = {
  module: string;
  label: string;
  style: string;
  nodes: TreeNodeInfo[];
  selIDs?: (string | number)[];
  expIDs?: (string | number)[];
};

export const defaultGBM: SelectGBMType = {
  gbmod: G.Tabs.find((t) => t.type === C.GENBOOK)?.module || '',
  selectedKeys: [],
  expandedKeys: [],
};

class GBSelect extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: GBSelectProps) {
    super(props);
    const { initialGBM } = props;
    const s: GBSelectState = {
      selectedMod: initialGBM?.gbmod || '',
      isOpen: false,
    };
    this.state = s;

    this.handler = this.handler.bind(this);
  }

  handler(ev: React.SyntheticEvent) {
    const props = this.props as GBSelectProps;
    const { onGbmodChange } = props;
    switch (ev.type) {
      case 'click': {
        this.setState({
          isOpen: true,
        } as Partial<GBSelectState>);
        break;
      }
      case 'change': {
        const e = ev as React.ChangeEvent<HTMLSelectElement>;
        const { initialGBM } = props;
        if (initialGBM?.gbmod) {
          this.setState({
            selectedMod: e.target.value,
          } as Partial<GBSelectState>);
          if (typeof onGbmodChange === 'function') {
            onGbmodChange(e.target.value);
          }
        }
        break;
      }
      case 'leave': {
        this.setState({
          isOpen: false,
        } as Partial<GBSelectState>);
        break;
      }
      case 'enter': {
        /* currently done by 'click'
        this.setState({
          isOpen: true,
        } as Partial<GBSelectState>);
        */
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
      onSelection,
      onExpansion,
    } = props;
    const { selectedMod, isOpen } = state;
    const { handler } = this;

    // Use the selectGBM prop if initialGBM prop is undefined. Otherwise, use
    // stateGBM if the initialGBM prop is defined. If any prop remains undefined,
    // use a default value.
    let truth: Partial<SelectGBMType> | null | undefined = selectedMod
      ? { gbmod: selectedMod }
      : {};
    if (initialGBM === undefined) truth = selectGBM;
    else {
      if (!truth) truth = {};
      if ('gbmod' in initialGBM) truth.gbmod = selectGBM?.gbmod;
      if ('selectedKeys' in initialGBM)
        truth.selectedKeys = selectGBM?.selectedKeys;
      if ('expandedKeys' in initialGBM)
        truth.expandedKeys = selectGBM?.expandedKeys;
    }
    const finalTruth = (truth ?? defaultGBM) as SelectGBMType;
    finalTruth.gbmod = truth?.gbmod || defaultGBM.gbmod;
    finalTruth.selectedKeys = truth?.selectedKeys || defaultGBM.selectedKeys;
    finalTruth.expandedKeys = truth?.expandedKeys || defaultGBM.expandedKeys;
    const { gbmod, selectedKeys, expandedKeys } = finalTruth;

    // Modules available for selection, and their node lists:
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
        style: G.Tab[m].labelClass,
        nodes: genBookTreeNodes(G.LibSword.getGenBookTableOfContents(m), m),
      };
    });
    if (gbmodNodeLists) list.push(...gbmodNodeLists);

    const selmodNodes = list.find((x) => x.module === gbmod)?.nodes || [];
    const keynode = genBookKeyNode(selmodNodes, selectedKeys[0].toString());
    return (
      <Hbox {...addClass('gbselect', this.props)} pack="start" align="center">
        {list.length === 1 && (
          <Label className={list[0].style} value={list[0].label} />
        )}
        {list.length > 1 && (
          // ModuleMenu can only be used with installed modules!
          <Menulist value={gbmod} onChange={handler}>
            {list.map((x) => (
              <option key={x.module} className={x.style} value={x.module}>
                {x.label}
              </option>
            ))}
          </Menulist>
        )}
        {!isOpen && keynode && (
          <Vbox
            className="selector sel-closed"
            onMouseEnter={handler}
            onClick={handler}
          >
            <TreeView initialState={keynode ? [keynode] : []} />
          </Vbox>
        )}
        {isOpen && selmodNodes && (
          <Vbox className="selector sel-open" onMouseLeave={handler}>
            <TreeView
              initialState={selmodNodes}
              selectedIDs={selectedKeys}
              expandedIDs={expandedKeys}
              enableMultipleSelection={enableMultipleSelection}
              onSelection={(sel) => {
                if (!enableMultipleSelection) {
                  this.setState({ isOpen: false } as Partial<GBSelectState>);
                }
                if (onSelection) onSelection(sel);
              }}
              onExpansion={onExpansion}
            />
          </Vbox>
        )}
      </Hbox>
    );
  }
}
GBSelect.defaultProps = defaultProps;
GBSelect.propTypes = propTypes;

export default GBSelect;
