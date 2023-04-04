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
import {
  clone,
  dictTreeNodes,
  findFirstLeafNode,
  diff,
  keep,
  ofClass,
  findTreeNode,
  genBookTreeNodes,
} from '../../common';
import C from '../../constant';
import G from '../rg';
import { getAllDictionaryKeyList } from '../viewport/zdictionary';
import log from '../log';
import { addClass, xulDefaultProps, XulProps, xulPropTypes } from './xul';
import { Vbox } from './boxes';
import Menulist from './menulist';
import './selectOR.css';

// Allow users to select one or more chapters from any non-versekey SWORD
// module parent node.

export type SelectORMType = {
  ormod: string; // Genbks | Dicts SWORD module code
  keys: string[];
};

export type ORModNodeList = {
  ormod: string; // Genbks | Dicts SWORD module code
  label: string;
  labelClass: string;
  nodes: TreeNodeInfo[];
};

type FamilyNodes = {
  ancestorNodes: TreeNodeInfo[];
  childNodes: TreeNodeInfo[];
};

// The SelectOR can either keep its own state OR work as a controlled
// component. Properties of the initial prop that are undefined are
// controlled by the corresponding select prop and internal state is
// ignored, meaning the onSelection callback must be used to control
// the select prop of the component. Properties of the initial prop that
// are set will have their state kept withinin the component and any
// corresponding select prop will be ignored.
//
// The ormods prop is an array of INSTALLED Genbks|Dicts modules to select
// from. If left undefined, all installed non-versekey modules will be
// available.
//
// The ormodNodeLists prop is a list of Genbks|Dicts mods which need NOT BE
// INSTALLED but the name and node list must be provided as ormodNodeLists[].
export interface SelectORProps extends XulProps {
  initialORM?: Partial<SelectORMType>;
  selectORM?: Partial<SelectORMType>;
  ormods?: string[];
  ormodNodeLists?: ORModNodeList[];
  enableMultipleSelection?: boolean;
  enableParentSelection?: boolean;
  disabled?: boolean;
  onSelection?: (selection: SelectORMType, id?: string) => void;
}

const defaultProps = {
  ...xulDefaultProps,
  initialORM: undefined,
  selectORM: undefined,
  ormods: undefined,
  ormodNodeLists: undefined,
  enableMultipleSelection: false,
  enableParentSelection: false,
  disabled: undefined,
  onSelection: undefined,
};

const propTypes = {
  ...xulPropTypes,
  initialORM: PropTypes.object,
  selectORM: PropTypes.object,
  ormods: PropTypes.arrayOf(PropTypes.string),
  ormodNodeLists: PropTypes.arrayOf(PropTypes.object),
  enableMultipleSelection: PropTypes.bool,
  enableParentSelection: PropTypes.bool,
  disabled: PropTypes.bool,
  onSelection: PropTypes.func,
};

interface SelectORState {
  stateORM: SelectORMType;
}

class SelectOR extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  prevValues: SelectORMType;

  constructor(props: SelectORProps) {
    super(props);
    const { initialORM, ormods, ormodNodeLists } = props;
    const defaultORM: SelectORMType = {
      ormod:
        (ormods && ormods[0]) ||
        (ormodNodeLists && ormodNodeLists[0].ormod) ||
        G.Tabs.find((t) => !t.isVerseKey)?.module ||
        '',
      keys: [],
    };
    const s: SelectORState = {
      stateORM: {
        ...defaultORM,
        ...initialORM,
      },
    };
    this.state = s;

    this.prevValues = clone(s.stateORM);

    this.onChange = this.onChange.bind(this);
    this.checkSelection = this.checkSelection.bind(this);
    this.realStateORM = this.realStateORM.bind(this);
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

  onChange(ev: React.SyntheticEvent) {
    const props = this.props as SelectORProps;
    const { onSelection } = props;
    const { realStateORM, skipUpdate } = this;
    const e = ev as React.ChangeEvent<HTMLSelectElement>;
    const targ = ofClass(
      ['select-module', 'select-parent', 'select-child'],
      e.currentTarget
    );
    if (targ) {
      this.setState((prevState: SelectORState) => {
        let stateORM = realStateORM(prevState);
        if (targ.type === 'select-module') {
          const ormod = e.target.value;
          const nodes =
            G.Tab[ormod].type === C.GENBOOK
              ? genBookTreeNodes(G.Prefs, G.LibSword, ormod)
              : dictTreeNodes(getAllDictionaryKeyList(ormod), ormod);
          const keys = [findFirstLeafNode(nodes, nodes).id.toString()];
          stateORM = { ormod, keys };
        } else if (targ.type === 'select-parent') {
          stateORM.keys = [e.target.value];
        } else if (targ.type === 'select-child') {
          stateORM.keys = Array.from(e.target.selectedOptions).map(
            (o) => o.value
          );
        } else {
          throw new Error(`Unrecognized select: '${targ.type}'`);
        }
        if (onSelection) onSelection(stateORM, props.id);
        return skipUpdate(prevState.stateORM, stateORM)
          ? null
          : ({ stateORM } as Partial<SelectORState>);
      });
    }
  }

  // Insure state and onSelection contains final select values
  checkSelection() {
    const props = this.props as SelectORProps;
    const { onSelection } = props;
    const { prevValues, realStateORM } = this;
    const stateORM = realStateORM();
    if (diff(stateORM, prevValues)) {
      if (onSelection) onSelection(prevValues);
      this.setState({ stateORM: prevValues } as Partial<SelectORState>);
    }
  }

  openParent(id: string) {
    const props = this.props as SelectORProps;
    const { onSelection } = props;
    const { realStateORM, skipUpdate } = this;
    this.setState((prevState: SelectORState) => {
      const stateORM = realStateORM(prevState);
      stateORM.keys = [id];
      if (onSelection) onSelection(stateORM, props.id);
      return skipUpdate(prevState.stateORM, stateORM)
        ? null
        : ({ stateORM } as Partial<SelectORState>);
    });
  }

  // Don't trigger a state update when only ignored state values change.
  skipUpdate(prevStateORM: SelectORMType, newStateORM: SelectORMType): boolean {
    const props = this.props as SelectORProps;
    const { initialORM } = props;
    if (initialORM) {
      const p = keep(
        prevStateORM,
        Object.keys(initialORM) as (keyof typeof initialORM)[]
      );
      const n = keep(
        newStateORM,
        Object.keys(initialORM) as (keyof typeof initialORM)[]
      );
      return !diff(p, n);
    }
    return true;
  }

  // Use the selectORM child prop if initialORM child prop is not defined.
  // Otherwise, use the stateORM child prop.
  realStateORM(prevState?: Partial<SelectORState>): SelectORMType {
    const props = this.props as SelectORProps;
    const state = clone(prevState || this.state) as SelectORState;
    const { selectORM, initialORM } = props;
    const { stateORM } = state;
    const selection = stateORM;
    const checkProps: (keyof SelectORState['stateORM'])[] = ['ormod', 'keys'];
    checkProps.forEach((p) => {
      if (!(initialORM && p in initialORM)) {
        if (selectORM && p in selectORM) selection[p] = selectORM[p] as any;
        else
          log.warn(
            `SelectOR selectORM.${p} and initialORM.${p} are both undefined.`
          );
      }
    });
    return selection;
  }

  render() {
    const props = this.props as SelectORProps;
    const {
      ormods: ormodsProp,
      ormodNodeLists,
      enableMultipleSelection,
      enableParentSelection,
    } = props;
    const { realStateORM, openParent, onChange } = this;
    const { ormod, keys } = realStateORM();

    // Get modules to be made available for selection, and their node lists:
    const list: ORModNodeList[] = ormodNodeLists || [];
    const propNodeLists = (
      ormodsProp && !ormodsProp.length
        ? []
        : ormodsProp || G.Tabs.map((t) => t.module)
    )
      .filter(
        (m) =>
          m && m in G.Tab && [C.GENBOOK, C.DICTIONARY].includes(G.Tab[m].type)
      )
      .map((m) => {
        return {
          ormod: m,
          label: G.Tab[m].label,
          labelClass: G.Tab[m].labelClass,
          nodes:
            G.Tab[m].type === C.GENBOOK
              ? genBookTreeNodes(G.Prefs, G.LibSword, m)
              : dictTreeNodes(getAllDictionaryKeyList(m), m),
        };
      });
    list.push(...propNodeLists);

    const isDictMod = G.Tab[ormod].tabType === 'Dicts';
    const nodes = list.find((l) => l.ormod === ormod)?.nodes || [];
    if (!nodes || nodes.length === 0) return null;
    const selectedNodes = keys.map((k) => findTreeNode(nodes, k));
    const showNodes = (
      !selectedNodes.length || selectedNodes.some((kn) => !kn)
        ? nodes
        : selectedNodes
    ) as TreeNodeInfo[];
    const { ancestorNodes, childNodes } = nodeFamily(
      nodes,
      findFirstLeafNode(nodes, showNodes),
      isDictMod
    );

    // Generate all HTML select elements
    const selects: JSX.Element[] = [];

    // Module selector
    this.prevValues.ormod = ormod;
    selects.push(
      <Menulist
        className="select-module"
        key={['sm', ormod].join('.')}
        value={ormod}
        disabled={ormod === list[0].ormod && list.length === 1}
        onChange={onChange}
      >
        {list.map((x) => (
          <option
            key={['smop', x.ormod].join('.')}
            className={x.labelClass}
            value={x.ormod}
          >
            {x.label}
          </option>
        ))}
      </Menulist>
    );

    // Ancestor selector(s) if any
    selects.push(
      ...ancestorNodes.map((n, i) => {
        const children = findSiblings(n.id, nodes, isDictMod);
        return (
          <Menulist
            className={[
              'select-parent',
              children.length === 1 ? 'hide' : '',
            ].join(' ')}
            key={['sp', n.id].join('.')}
            value={n.id.toString()}
            data-index={i}
            onChange={onChange}
          >
            {children.map((cn) => {
              const label = cn.label.toString();
              const className = !Number.isNaN(Number(label))
                ? undefined
                : `cs-${ormod}`;
              return (
                <option
                  key={['spop', cn.id].join('.')}
                  className={className}
                  value={cn.id}
                >
                  {label}
                </option>
              );
            })}
          </Menulist>
        );
      })
    );

    // Child selector
    this.prevValues.keys = keys;
    const value = enableMultipleSelection ? keys : keys[0];
    const parentNode = ancestorNodes.at(-1);
    selects.push(
      <Menulist
        className="select-child"
        key={['ch', parentNode ? parentNode.id : module].join('.')}
        multiple={!!enableMultipleSelection}
        value={value}
        onChange={onChange}
      >
        {childNodes.map((n) => {
          const className = !Number.isNaN(Number(n.label))
            ? undefined
            : `cs-${ormod}`;
          const clickHandler = {} as any;
          if (enableMultipleSelection && n.childNodes && n.childNodes.length) {
            clickHandler[enableParentSelection ? 'onDoubleClick' : 'onClick'] =
              (e: React.MouseEvent<HTMLSelectElement>) => {
                openParent(e.currentTarget.value);
              };
          }
          return (
            <option
              key={['chop', n.id].join('.')}
              className={className}
              value={n.id}
              {...clickHandler}
            >
              {`${n.childNodes && n.childNodes.length ? '❭ ' : ''}${n.label}`}
            </option>
          );
        })}
      </Menulist>
    );

    return (
      <Vbox {...addClass('selector', this.props)} pack="start" align="start">
        {selects}
      </Vbox>
    );
  }
}
SelectOR.defaultProps = defaultProps;
SelectOR.propTypes = propTypes;

export default SelectOR;

// Return ancestor nodes of any non-versekey module key. The returned array is
// ordered from greatest ancestor down to parent. If there is no parent, an
// empty array is returned. If id is not present in nodes an error is thrown.
function findAncestors(
  id: string | number,
  nodes: TreeNodeInfo[],
  isDictMod: boolean
): { ancestors: TreeNodeInfo[]; self: TreeNodeInfo } {
  let ancestors: TreeNodeInfo[] = [];
  const r1 = isDictMod ? [id.toString()] : id.toString().split(C.GBKSEP);
  let end = '';
  if (!isDictMod && !r1[r1.length - 1]) {
    r1.pop();
    end = C.GBKSEP;
  }
  ancestors = r1.map((k, i, a) => {
    let fid = k;
    if (!isDictMod) {
      fid = a.slice(0, i + 1).join(C.GBKSEP);
      fid += i === a.length - 1 ? end : C.GBKSEP;
    }
    const fnd = findTreeNode(nodes, fid);
    if (!fnd) throw new Error(`Node not found: '${fid}'`);
    return fnd;
  });
  const self = ancestors.pop() as TreeNodeInfo;
  return { ancestors, self };
}

function findSiblings(
  id: string | number,
  nodes: TreeNodeInfo[],
  isDictMod: boolean
): TreeNodeInfo[] {
  const { ancestors } = findAncestors(id, nodes, isDictMod);
  if (ancestors.length) {
    const parent = ancestors.pop();
    if (parent?.childNodes) return parent.childNodes;
    throw new Error(`Parent has no children: '${id}'`);
  }
  return nodes;
}

// A valid node family will be returned from any node that exist in nodes.
// If the selected node does not exist in nodes, an error is thrown. The
// 'family' returned will be at least an array of childNodes, while
// everything else may or may not have values.
function nodeFamily(
  nodes: TreeNodeInfo[],
  node: string | TreeNodeInfo,
  isDictMod: boolean
): FamilyNodes {
  const selectedChildID = typeof node === 'string' ? node : node.id.toString();
  const { ancestors: ancestorNodes } = findAncestors(
    selectedChildID,
    nodes,
    isDictMod
  );
  const parentNode = ancestorNodes.at(-1);
  if (parentNode && parentNode.childNodes) {
    const { childNodes } = parentNode;
    return {
      ancestorNodes,
      childNodes,
    };
  }
  return {
    ancestorNodes: [],
    childNodes: nodes,
  };
}
