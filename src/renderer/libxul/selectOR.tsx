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
  findTreeAncestors,
  findTreeSiblings,
  gbAncestorIDs,
} from '../../common';
import C from '../../constant';
import G from '../rg';
import { getAllDictionaryKeyList } from '../viewport/zdictionary';
import log from '../log';
import { addClass, xulDefaultProps, XulProps, xulPropTypes } from './xul';
import { Vbox } from './boxes';
import Menulist from './menulist';
import ModuleMenu from './modulemenu';
import './selectOR.css';

// Allow users to select one or more chapters from any non-versekey SWORD
// module parent node.

export type SelectORMType = {
  otherMod: string; // Genbks | Dicts SWORD module code
  keys: string[];
};

export type NodeListOR = {
  otherMod: string; // Genbks | Dicts SWORD module code
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
// The otherMods prop is an array of INSTALLED non-versekey modules to
// select from. If left undefined, all installed non-versekey modules will
// be available.
//
// The nodeLists prop is a list of versekey mods to select from which need
// NOT BE INSTALLED since the module and node list is provided.
//
// If initialORM or selectORM selects a module which is not installed, and
// also has no corresponding nodeLists[] entry, all selectors but the module
// selector will be disabled.
export interface SelectORProps extends XulProps {
  initialORM?: Partial<SelectORMType>;
  selectORM?: Partial<SelectORMType>;
  otherMods?: string[];
  nodeLists?: NodeListOR[];
  enableMultipleSelection: boolean;
  enableParentSelection: boolean;
  disabled: boolean;
  onSelection?: (selection: SelectORMType | undefined, id?: string) => void;
}

const defaultProps = {
  ...xulDefaultProps,
  initialORM: undefined,
  selectORM: undefined,
  otherMods: undefined,
  nodeLists: undefined,
  enableMultipleSelection: false,
  enableParentSelection: false,
  disabled: false,
  onSelection: undefined,
};

const propTypes = {
  ...xulPropTypes,
  initialORM: PropTypes.object,
  selectORM: PropTypes.object,
  otherMods: PropTypes.arrayOf(PropTypes.string),
  nodeLists: PropTypes.arrayOf(PropTypes.object),
  enableMultipleSelection: PropTypes.bool,
  enableParentSelection: PropTypes.bool,
  disabled: PropTypes.bool,
  onSelection: PropTypes.func,
};

interface SelectORState {
  stateORM: SelectORMType | undefined;
}

class SelectOR extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: SelectORProps) {
    super(props);
    const { initialORM, otherMods, nodeLists } = props;
    const defaultORM: SelectORMType = {
      otherMod:
        (otherMods && otherMods[0]) ||
        (nodeLists && nodeLists[0].otherMod) ||
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

  componentDidUpdate(
    _prevProps: SelectORProps,
    prevState: SelectORState
  ): void {
    const { checkSelection } = this;
    checkSelection(prevState);
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
      const { value } = e.target;
      const tabType = (value && value in G.Tab && G.Tab[value].tabType) || '';
      this.setState((prevState: SelectORState) => {
        let stateORM: SelectORMType | undefined = realStateORM(prevState);
        if (targ.type === 'select-module') {
          let nodes: TreeNodeInfo[] = [];
          if (tabType === 'Genbks') {
            nodes = genBookTreeNodes(G.DiskCache, G.LibSword, value);
          } else if (tabType === 'Dicts') {
            nodes = dictTreeNodes(getAllDictionaryKeyList(value), value);
          }
          const leafNode = findFirstLeafNode(nodes, nodes);
          const keys = leafNode ? [leafNode.id.toString()] : [];
          stateORM = { otherMod: value, keys };
        } else if (stateORM && targ.type === 'select-parent') {
          stateORM.keys = [e.target.value];
        } else if (stateORM && targ.type === 'select-child') {
          stateORM.keys = Array.from(e.target.selectedOptions).map(
            (o) => o.value
          );
        } else {
          throw new Error(`Unrecognized select: '${targ.type}'`);
        }
        if (onSelection) {
          onSelection(stateORM, props.id);
        }
        return skipUpdate(prevState.stateORM, stateORM)
          ? null
          : ({ stateORM } as Partial<SelectORState>);
      });
    }
  }

  // Insure state and onSelection contains the real select values.
  checkSelection(prevState?: SelectORState) {
    const { stateORM } = prevState || {};
    const props = this.props as SelectORProps;
    const { onSelection } = props;
    const { realStateORM } = this;
    const realORM = realStateORM();
    if (!prevState || diff(stateORM, realORM)) {
      if (onSelection) onSelection(realORM);
      this.setState({ stateORM: realORM } as Partial<SelectORState>);
    }
  }

  openParent(id: string) {
    const props = this.props as SelectORProps;
    const { onSelection } = props;
    const { realStateORM, skipUpdate } = this;
    this.setState((prevState: SelectORState) => {
      const stateORM = realStateORM(prevState);
      if (!stateORM) return null;
      stateORM.keys = [id];
      if (onSelection) onSelection(stateORM, props.id);
      return skipUpdate(prevState.stateORM, stateORM)
        ? null
        : ({ stateORM } as Partial<SelectORState>);
    });
  }

  // Don't trigger a state update when only ignored state values change.
  skipUpdate(
    prevStateORM: SelectORMType | undefined,
    newStateORM: SelectORMType | undefined
  ): boolean {
    const props = this.props as SelectORProps;
    const { initialORM } = props;
    if (initialORM) {
      if (prevStateORM && newStateORM) {
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
      return prevStateORM === newStateORM;
    }
    return true;
  }

  // Use the selectORM child prop if initialORM child prop is not defined.
  // Otherwise, use the stateORM child prop.
  realStateORM(prevState?: Partial<SelectORState>): SelectORMType | undefined {
    const props = this.props as SelectORProps;
    const state = clone(prevState || this.state) as SelectORState;
    const { selectORM, initialORM } = props;
    const { stateORM } = state;
    const selection = stateORM;
    if (selection) {
      const checkProps: (keyof SelectORMType)[] = ['otherMod', 'keys'];
      checkProps.forEach((p) => {
        if (!(initialORM && p in initialORM)) {
          if (selectORM && p in selectORM) selection[p] = selectORM[p] as any;
          else
            log.warn(
              `SelectOR selectORM.${p} and initialORM.${p} are both undefined.`
            );
        }
      });
    }
    return selection;
  }

  render() {
    const props = this.props as SelectORProps;
    const {
      otherMods: otherModsProp,
      nodeLists,
      enableMultipleSelection,
      enableParentSelection,
    } = props;
    const { disabled } = props;
    const { realStateORM, openParent, onChange } = this;
    const realState = realStateORM();
    if (!realState) return null;
    const { otherMod, keys } = realState;

    // Get modules to be made available for selection, and their node lists:
    const list: NodeListOR[] = nodeLists || [];
    const propNodeLists: NodeListOR[] = (
      otherModsProp && !otherModsProp.length
        ? []
        : otherModsProp || G.Tabs.map((t) => t.module)
    )
      .filter((m) => m && m in G.Tab && !G.Tab[m].isVerseKey)
      .map((m) => {
        let nodes: TreeNodeInfo[] = [];
        if (G.Tab[m].tabType === 'Genbks') {
          nodes = genBookTreeNodes(G.DiskCache, G.LibSword, m);
        } else if (G.Tab[m].tabType === 'Dicts') {
          nodes = dictTreeNodes(getAllDictionaryKeyList(m), m);
        }
        return {
          otherMod: m,
          label: G.Tab[m].label,
          labelClass: G.Tab[m].labelClass,
          nodes,
        };
      });
    list.push(...propNodeLists);

    const isDictMod = otherMod in G.Tab && G.Tab[otherMod].tabType === 'Dicts';
    let nodes = list.find((l) => l.otherMod === otherMod)?.nodes || [];
    let selectedModuleIsInstalled: boolean;
    if (!nodes || nodes.length === 0) {
      selectedModuleIsInstalled = false;
      // If there is no no list available (ie. the module is no longer
      // installed) then create a dummy node list with no options.
      // Note: it's ok to treat Dict as GBmod here since this dummy
      // cannot be edited.
      const ancIDs = keys[0] ? gbAncestorIDs(keys[0]) : [];
      if (keys[0]) ancIDs.push(keys[0]);
      let pn: TreeNodeInfo | undefined;
      for (let i = 0; i < ancIDs.length; i += 1) {
        const p = ancIDs[i].split(C.GBKSEP);
        if (!p.at(-1)) p.pop();
        const n: TreeNodeInfo = {
          id: ancIDs[i],
          label: p.pop() || '',
        };
        if (!pn) nodes = [n];
        else {
          pn.hasCaret = true;
          pn.isExpanded = true;
          pn.childNodes = [n];
        }
        pn = n;
      }
      list.push({
        otherMod,
        label: otherMod,
        labelClass: 'cs-locale',
        nodes,
      });
    } else selectedModuleIsInstalled = true;
    if (!nodes || !nodes.length) return null;
    const selectedNodes = keys.map((k) => findTreeNode(nodes, k));
    const showNodes = (
      !selectedNodes.length || selectedNodes.some((kn) => !kn)
        ? nodes
        : selectedNodes
    ) as TreeNodeInfo[];
    const leafNode = findFirstLeafNode(nodes, showNodes);
    if (!leafNode) return null;

    const { ancestorNodes, childNodes } = nodeFamily(
      nodes,
      leafNode,
      isDictMod
    );

    // Generate all HTML select elements
    const selects: JSX.Element[] = [];

    // Module selector
    selects.push(
      <ModuleMenu
        key={['sm', otherMod].join('.')}
        className="select-module"
        value={otherMod}
        modules={list.map((x) => x.otherMod)}
        disabled={
          disabled || (otherMod === list[0].otherMod && list.length === 1)
        }
        onChange={onChange}
      />
    );

    // Ancestor selector(s) if any
    selects.push(
      ...ancestorNodes.map((n, i) => {
        const children = findTreeSiblings(n.id, nodes);
        return (
          <Menulist
            className={[
              'select-parent',
              children.length === 1 ? 'hide' : '',
            ].join(' ')}
            key={['sp', n.id].join('.')}
            value={n.id.toString()}
            disabled={disabled || !selectedModuleIsInstalled}
            data-index={i}
            onChange={onChange}
          >
            {children.map((cn) => {
              const label = cn.label.toString();
              const className = !Number.isNaN(Number(label))
                ? undefined
                : `cs-${otherMod}`;
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
    const value = enableMultipleSelection ? keys : keys[0];
    const parentNode = ancestorNodes.at(-1);
    if (childNodes.length) {
      selects.push(
        <Menulist
          className="select-child"
          key={['ch', parentNode ? parentNode.id : module].join('.')}
          multiple={!!enableMultipleSelection}
          value={value}
          disabled={disabled || !selectedModuleIsInstalled}
          onChange={onChange}
        >
          {childNodes.map((n) => {
            const className = !Number.isNaN(Number(n.label))
              ? undefined
              : `cs-${otherMod}`;
            const clickHandler = {} as any;
            if (enableMultipleSelection && n.childNodes?.length) {
              clickHandler[
                enableParentSelection ? 'onDoubleClick' : 'onClick'
              ] = (e: React.MouseEvent<HTMLSelectElement>) => {
                openParent(e.currentTarget.value);
              };
            }
            const ids = [n.id];
            n.childNodes?.forEach((cn) => ids.push(cn.id));
            return (
              <option
                key={['chop', className, ...ids].join('.')}
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
    }

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
  const { ancestors: ancestorNodes } = findTreeAncestors(
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
