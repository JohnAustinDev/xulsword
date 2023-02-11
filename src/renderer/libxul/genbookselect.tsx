/* eslint-disable @typescript-eslint/no-use-before-define */
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
import { TreeNodeInfo } from '@blueprintjs/core';
import { clone, diff, genBookTreeNodes, keep, ofClass } from '../../common';
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
  parent: string; // full length gbkey
  children: string[]; // full length gbkeys
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
  enableParentSelection?: boolean;
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
  enableParentSelection: false,
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
  enableParentSelection: PropTypes.bool,
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

    this.prevValues = clone(s.stateGBM);

    this.handler = this.handler.bind(this);
    this.checkSelection = this.checkSelection.bind(this);
    this.realStateGBM = this.realStateGBM.bind(this);
    this.skipUpdate = this.skipUpdate.bind(this);
    this.openParent = this.openParent.bind(this);
  }

  componentDidMount(): void {
    const { checkSelection } = this;
    checkSelection();
  }

  componentDidUpdate(): void {
    const { checkSelection } = this;
    checkSelection();
  }

  handler(ev: React.SyntheticEvent) {
    const props = this.props as GBSelectProps;
    const { onSelection, enableMultipleSelection } = props;
    const { realStateGBM, skipUpdate, openParent } = this;
    switch (ev.type) {
      case 'click':
      case 'dblclick': {
        const e = ev as React.MouseEvent;
        const t = e.currentTarget as HTMLSelectElement;
        openParent(t.value);
        break;
      }
      case 'change': {
        const e = ev as React.ChangeEvent<HTMLSelectElement>;
        const targ = ofClass(
          ['select-module', 'select-parent', 'select-child'],
          e.currentTarget
        );
        if (targ) {
          this.setState((prevState: GBSelectState) => {
            let stateGBM = realStateGBM(prevState);
            if (targ.type === 'select-module') {
              stateGBM = {
                gbmod: e.target.value,
                parent: '',
                children: [],
              };
            } else if (targ.type === 'select-child') {
              stateGBM.children = Array.from(e.target.selectedOptions).map(
                (o) => o.value
              );
              if (
                !enableMultipleSelection &&
                e.target.value.endsWith(C.GBKSEP)
              ) {
                stateGBM.parent = e.target.value;
                stateGBM.children = [];
              }
            } else {
              stateGBM.parent = e.target.value;
              stateGBM.children = [];
            }
            if (onSelection) onSelection(stateGBM, props.id);
            return skipUpdate(prevState.stateGBM, stateGBM)
              ? null
              : { stateGBM };
          });
        }

        break;
      }
      default:
        throw new Error(`Unhandled genbookselect event type ${ev.type}`);
    }
  }

  // Insure state and onSelection contains final select values
  checkSelection() {
    const props = this.props as GBSelectProps;
    const { onSelection } = props;
    const { prevValues, realStateGBM } = this;
    const stateGBM = realStateGBM();
    if (diff(stateGBM, prevValues)) {
      if (onSelection) onSelection(prevValues);
      this.setState({ stateGBM: prevValues });
    }
  }

  openParent(id: string) {
    const props = this.props as GBSelectProps;
    const { onSelection } = props;
    const { realStateGBM, skipUpdate } = this;
    this.setState((prevState: GBSelectState) => {
      const stateGBM = realStateGBM(prevState);
      stateGBM.parent = id;
      stateGBM.children = [];
      if (onSelection) onSelection(stateGBM, props.id);
      return skipUpdate(prevState.stateGBM, stateGBM) ? null : { stateGBM };
    });
  }

  // Don't trigger a state update when only ignored state values change.
  skipUpdate(prevStateGBM: SelectGBMType, newStateGBM: SelectGBMType): boolean {
    const props = this.props as GBSelectProps;
    const { initialGBM } = props;
    if (initialGBM) {
      const p = keep(prevStateGBM, Object.keys(initialGBM));
      const n = keep(newStateGBM, Object.keys(initialGBM));
      return !diff(p, n);
    }
    return true;
  }

  // Use the selectGBM child prop if initialGBM child prop is not defined.
  // Otherwise, use the stateGBM prop.
  realStateGBM(prevState?: Partial<GBSelectState>): SelectGBMType {
    const props = this.props as GBSelectProps;
    const state = clone(prevState || this.state) as GBSelectState;
    const { selectGBM, initialGBM } = props;
    const { stateGBM } = state;
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
    return selection;
  }

  render() {
    const props = this.props as GBSelectProps;
    const {
      gbmods: gbmodsProp,
      gbmodNodeLists,
      enableMultipleSelection,
      enableParentSelection,
    } = props;
    const { realStateGBM, handler } = this;

    const { gbmod, parent: parentx, children: childrenx } = realStateGBM();

    // Get modules to be made available for selection, and their node lists:
    const list: GBModNodeList[] = gbmodNodeLists || [];
    const propNodeLists = (
      gbmodsProp && !gbmodsProp.length
        ? []
        : gbmodsProp || G.Tabs.map((t) => t.module)
    )
      .filter((m) => m && m in G.Tab && G.Tab[m].type === C.GENBOOK)
      .map((m) => {
        return {
          module: m,
          label: G.Tab[m].label,
          labelClass: G.Tab[m].labelClass,
          nodes: genBookTreeNodes(G.LibSword.getGenBookTableOfContents(m), m),
        };
      });
    list.push(...propNodeLists);

    // Insure a leaf node is shown when there is no parent selection.
    const nodes = list.find((l) => l.module === gbmod)?.nodes || [];
    let ancestors = findAncestors(parentx, nodes);
    let parent = parentx;
    let children = childrenx;
    if (!ancestors.length) parent = '';
    if (!parent) {
      children = [];
      parent = findParentOfFirstLeaf(nodes);
      ancestors = findAncestors(parent, nodes);
    }

    // If parent has no children, then use grandparent
    if (!ancestors[ancestors.length - 1].childNodes?.length) {
      ancestors.pop();
      parent = ancestors[ancestors.length - 1].id.toString();
      children = [];
    }

    // Generate all HTML select elements
    const selects: JSX.Element[] = [];

    // Module selector
    this.prevValues.gbmod = gbmod;
    selects.push(
      <Menulist
        className="select-module"
        key={['sm', gbmod].join('.')}
        value={gbmod}
        disabled={gbmod === list[0].module && list.length === 1}
        onChange={handler}
      >
        {list.map((x) => (
          <option
            key={['smop', x.module].join('.')}
            className={x.labelClass}
            value={x.module}
          >
            {x.label}
          </option>
        ))}
      </Menulist>
    );
    // Ancestor selectors
    if (ancestors) {
      this.prevValues.parent = parent;
      selects.push(
        ...ancestors.map((n, i) => (
          <Menulist
            className={[
              'select-parent',
              findSiblings(n.id, nodes).length === 1 ? 'hide' : '',
            ].join(' ')}
            key={['sp', n.id].join('.')}
            value={n.id.toString()}
            data-index={i}
            onChange={handler}
          >
            {findSiblings(n.id, nodes).map((cn) => {
              if (cn) {
                const label = cn.label.toString();
                const className = !Number.isNaN(Number(label))
                  ? undefined
                  : `cs-${gbmod}`;
                return (
                  <option
                    key={['spop', cn.id].join('.')}
                    className={className}
                    value={cn.id}
                  >
                    {label}
                  </option>
                );
              }
              return null;
            })}
          </Menulist>
        ))
      );
      // Child selector
      const parentNode = ancestors[ancestors.length - 1];
      const { childNodes } = parentNode;
      if (childNodes) {
        // Deselect any child selections which don't exist
        if (children.some((id) => !childNodes.find((cn) => cn.id === id))) {
          children = [];
        }
        this.prevValues.children = children;
        const value = enableMultipleSelection ? children : children[0];
        selects.push(
          <Menulist
            className="select-child"
            key={['ch', parentNode.id].join('.')}
            multiple={!!enableMultipleSelection}
            value={value}
            onChange={handler}
          >
            {childNodes.map((n) => {
              const className = !Number.isNaN(Number(n.label))
                ? undefined
                : `cs-${gbmod}`;
              const clickHandler = {} as any;
              if (
                enableMultipleSelection &&
                n.childNodes &&
                n.childNodes.length
              ) {
                clickHandler[
                  enableParentSelection ? 'onDoubleClick' : 'onClick'
                ] = handler;
              }
              return (
                <option
                  key={['chop', n.id].join('.')}
                  className={className}
                  value={n.id}
                  {...clickHandler}
                >
                  {`${n.childNodes && n.childNodes.length ? '❭ ' : ''}${
                    n.label
                  }`}
                </option>
              );
            })}
          </Menulist>
        );
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

function findAncestors(
  id: string | number,
  nodes?: TreeNodeInfo[]
): TreeNodeInfo[] {
  let r: TreeNodeInfo[] = [];
  if (nodes) {
    const r1 = id.toString().split(C.GBKSEP);
    let end = '';
    if (!r1[r1.length - 1]) {
      r1.pop();
      end = C.GBKSEP;
    }
    const r2 = r1.map((_k, i, a) => {
      let fid = a.slice(0, i + 1).join(C.GBKSEP);
      fid += i === a.length - 1 ? end : C.GBKSEP;
      const fnd = findNode(fid, nodes);
      return fnd;
    });
    if (!r2.some((n) => n === undefined)) r = r2 as TreeNodeInfo[];
  }
  return r;
}

function findSiblings(
  id: string | number,
  nodes?: TreeNodeInfo[]
): TreeNodeInfo[] {
  if (nodes) {
    const ancestors = findAncestors(id, nodes);
    if (ancestors.length) {
      ancestors.pop(); // remove self
      const parent = ancestors.pop();
      return parent && parent.childNodes ? parent.childNodes : nodes;
    }
  }
  const self = findNode(id, nodes);
  return self ? [self] : [];
}

function findNode(
  id: string | number,
  nodes?: TreeNodeInfo[]
): TreeNodeInfo | undefined {
  if (nodes) {
    for (let x = 0; x < nodes.length; x += 1) {
      if (nodes[x].id === id) return nodes[x];
      const rc = findNode(id, nodes[x].childNodes);
      if (rc) return rc;
    }
  }
  return undefined;
}

function findParentOfFirstLeaf(nodes?: TreeNodeInfo[]): string {
  if (nodes) {
    const r = nodes.find(
      (n) =>
        n.childNodes?.length &&
        n.childNodes?.find((cn) => !('childNodes' in cn))
    );
    if (r) return r.id.toString();
    for (let x = 0; x < nodes.length; x += 1) {
      const cn = nodes[x]?.childNodes;
      if (cn && cn.length) {
        const res = findParentOfFirstLeaf(cn);
        if (res) return res;
      }
    }
  }
  return '';
}
