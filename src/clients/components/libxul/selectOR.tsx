import React from 'react';
import PropTypes from 'prop-types';
import {
  dictTreeNodes,
  findFirstLeafNode,
  ofClass,
  findTreeNode,
  findTreeAncestors,
  findTreeSiblings,
  gbAncestorIDs,
  clone,
  stringHash,
} from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import { addClass, xulPropTypes } from './xul.tsx';
import { Vbox } from './boxes.tsx';
import Menulist from './menulist.tsx';
import ModuleMenu from './modulemenu.tsx';
import './selectOR.css';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { XulProps } from './xul.tsx';

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

// The SelectOR maintains its own state starting at initialORM. So
// onSelection must be used to read component selection. The key
// prop may be used to reset state to latest initialORM at any time.
//
// When enableParentSelection prop is set, an 'introduction' child option is
// prepended which allows selection of the parent key. When enableParentSelection
// is false, there will be no 'introduction' child option and selecting the
// parent will automatically resolve to the first child. Note: TreeNodes where
// childNodes is either undefined or [] are both considered to be leaf nodes,
// NOT parent nodes.
//
// The otherMods prop is an array of INSTALLED non-versekey modules to
// select from. If left undefined, all installed non-versekey modules will
// be available.
//
// The nodeLists prop is a list of versekey mods to select from which need
// NOT BE INSTALLED since the module and node list is provided.
//
// If initialORM selects a module which is not installed, and also has no
// corresponding nodeLists[] entry, all selectors but the module selector
// will be disabled.
export type SelectORProps = {
  initialORM: SelectORMType;
  otherMods?: string[];
  nodeLists?: NodeListOR[];
  enableMultipleSelection?: boolean;
  enableParentSelection?: boolean;
  disabled?: boolean;
  onSelection: (selection: SelectORMType | undefined, id?: string) => void;
} & XulProps;

const propTypes = {
  ...xulPropTypes,
  initialORM: PropTypes.object.isRequired,
  otherMods: PropTypes.arrayOf(PropTypes.string),
  nodeLists: PropTypes.arrayOf(PropTypes.object),
  enableMultipleSelection: PropTypes.bool,
  enableParentSelection: PropTypes.bool,
  disabled: PropTypes.bool,
  onSelection: PropTypes.func.isRequired,
};

type SelectORState = RenderPromiseState & {
  selection: SelectORMType;
};

class SelectOR extends React.Component implements RenderPromiseComponent {
  static propTypes: typeof propTypes;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  selectorValue: string[];

  constructor(props: SelectORProps) {
    super(props);
    const { initialORM, otherMods, nodeLists } = props;
    const defaultORM: SelectORMType = {
      otherMod:
        otherMods?.[0] ||
        nodeLists?.[0].otherMod ||
        G.Tabs.find((t) => !t.isVerseKey)?.module ||
        '',
      keys: [],
    };
    const s: SelectORState = {
      selection: {
        ...defaultORM,
        ...initialORM,
      },
      renderPromiseID: 0,
    };
    this.state = s;

    this.onChange = this.onChange.bind(this);
    this.openParent = this.openParent.bind(this);

    this.selectorValue = s.selection.keys;

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
  }

  componentDidMount() {
    const { renderPromise } = this;
    renderPromise.dispatch();
  }

  componentDidUpdate() {
    const { id, onSelection } = this.props as SelectORProps;
    const { selection } = this.state as SelectORState;
    const { renderPromise, selectorValue } = this;
    renderPromise.dispatch();
    if (stringHash(selectorValue) !== stringHash(selection.keys)) {
      const newsel = {
        ...selection,
        keys: selectorValue,
      };
      if (onSelection) onSelection(newsel, id);
      this.setState({selection: newsel} as Partial<SelectORState>);
    }
  }

  onChange(ev: React.SyntheticEvent) {
    const props = this.props as SelectORProps;
    const { onSelection } = props;
    const { renderPromise } = this;
    const e = ev as React.ChangeEvent<HTMLSelectElement>;
    const targ = ofClass(
      ['select-module', 'select-parent', 'select-child'],
      e.currentTarget,
    );
    if (targ) {
      const { value } = e.target;
      const tabType = (value && value in G.Tab && G.Tab[value].tabType) || '';
      this.setState(async (prevState: SelectORState) => {
        let { selection } = prevState;
        if (targ.type === 'select-module') {
          let nodes: TreeNodeInfo[] = [];
          if (tabType === 'Genbks') {
            nodes = GI.genBookTreeNodes([], renderPromise, value);
          } else if (tabType === 'Dicts') {
            const keylist = GI.getAllDictionaryKeyList(
              [],
              renderPromise,
              value,
            );
            nodes = dictTreeNodes(keylist, value);
          }
          const leafNode = findFirstLeafNode(nodes, nodes);
          const keys = leafNode ? [leafNode.id.toString()] : [];
          selection = { otherMod: value, keys };
        } else if (selection && targ.type === 'select-parent') {
          selection.keys = [e.target.value];
        } else if (selection && targ.type === 'select-child') {
          selection.keys = Array.from(e.target.selectedOptions).map(
            (o) => o.value,
          );
        } else {
          throw new Error(`Unrecognized select: '${targ.type}'`);
        }
        onSelection(selection, props.id);
        return { selection } as Partial<SelectORState>;
      });
    }
  }

  openParent(id: string) {
    const props = this.props as SelectORProps;
    const { onSelection } = props;
    this.setState((prevState: SelectORState) => {
      const { selection } = prevState;
      selection.keys = [id];
      onSelection(selection, props.id);
      return { selection } as Partial<SelectORState>;
    });
  }

  render() {
    const props = this.props as SelectORProps;
    const state = this.state as SelectORState;
    const { selection } = state;
    const {
      disabled,
      otherMods: otherModsProp,
      nodeLists,
      enableMultipleSelection,
      enableParentSelection,
    } = props;
    const { openParent, onChange, renderPromise, loadingRef } = this;
    const { otherMod, keys } = selection;

    // Get modules to be made available for selection, and their node lists:
    const list: NodeListOR[] = nodeLists || [];
    const propNodeListsMods: string[] = (
      otherModsProp && !otherModsProp.length
        ? []
        : otherModsProp || G.Tabs.map((t) => t.module)
    ).filter((m) => m && m in G.Tab && !G.Tab[m].isVerseKey);

    const propNodeLists: NodeListOR[] = propNodeListsMods.map((m) => {
      let nodes: TreeNodeInfo[] = [];
      if (G.Tab[m].tabType === 'Genbks') {
        nodes = GI.genBookTreeNodes(
          [
            {
              id: m,
              label: m,
            },
          ],
          renderPromise,
          m,
        );
      } else if (G.Tab[m].tabType === 'Dicts') {
        const keylist = GI.getAllDictionaryKeyList([], renderPromise, m);
        if (!renderPromise.waiting()) nodes = dictTreeNodes(keylist, m);
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
      // If there is no list available (ie. the module is no longer
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
    if (!nodes?.length) return null;
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
      isDictMod,
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
        allowNotInstalled
        disabled={
          disabled || (otherMod === list[0].otherMod && list.length === 1)
        }
        onChange={onChange}
      />,
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
              const { label } = cn;
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
      }),
    );

    // Child selector
    if (childNodes.length) {
      let selectedValue = enableMultipleSelection ? keys : keys[0];
      if (
        typeof selectedValue === 'string' &&
        (!selectedValue || selectedValue.endsWith('/'))
      ) {
        selectedValue =
          enableParentSelection && ancestorNodes.length
            ? ancestorNodes[ancestorNodes.length - 1].id.toString()
            : childNodes[0].id.toString();
      }
      this.selectorValue =
        typeof selectedValue === 'string' ? [selectedValue] : selectedValue;
      const parentNode = ancestorNodes.at(-1);
      selects.push(
        <Menulist
          className="select-child"
          key={['ch', parentNode ? parentNode.id : module].join('.')}
          multiple={!!enableMultipleSelection}
          value={selectedValue}
          disabled={disabled || !selectedModuleIsInstalled}
          onChange={onChange}
        >
          {enableParentSelection && ancestorNodes.length && (
            <option
              key={'chop.introduction'}
              className={'cs-locale'}
              value={ancestorNodes[ancestorNodes.length - 1].id}
            >
              {GI.i18n.t('', renderPromise, 'introduction.label')}
            </option>
          )}
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
                {n.label}
              </option>
            );
          })}
        </Menulist>,
      );
    }

    return (
      <Vbox
        domref={loadingRef}
        {...addClass('selector', this.props)}
        pack="start"
        align="start"
      >
        {selects}
      </Vbox>
    );
  }
}
SelectOR.propTypes = propTypes;

export default SelectOR;

// A valid node family will be returned from any node that exist in nodes.
// If the selected node does not exist in nodes, an error is thrown. The
// 'family' returned will be at least an array of childNodes, while
// everything else may or may not have values.
function nodeFamily(
  nodes: TreeNodeInfo[],
  node: string | TreeNodeInfo,
  isDictMod: boolean,
): FamilyNodes {
  const selectedChildID = typeof node === 'string' ? node : node.id.toString();
  const { ancestors: ancestorNodes } = findTreeAncestors(
    selectedChildID,
    nodes,
    isDictMod,
  );
  const parentNode = ancestorNodes.at(-1);
  if (parentNode?.childNodes) {
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
