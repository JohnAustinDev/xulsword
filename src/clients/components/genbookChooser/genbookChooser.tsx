import React from 'react';
import { clone, gbAncestorIDs, ofClass, stringHash } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import {
  audioGenBookNode,
  chooserGenbks,
  safeScrollIntoView,
} from '../../common.ts';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import { addClass } from '../libxul/xul.tsx';
import TreeView, { forEachNode } from '../libxul/treeview.tsx';
import '../chooser/chooser.css';
import './genbookChooser.css';

import type {
  AudioPlayerSelectionGB,
  AudioPlayerSelectionVK,
} from '../../../type.ts';
import type { Tree, TreeNodeInfo } from '@blueprintjs/core';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { XulProps } from '../libxul/xul.tsx';
import type { XulswordState } from '../xulsword/xulsword.tsx';

export type GenbookChooserProps = {
  panels: Array<string | null>;
  keys?: Array<string | null>;
  onAudioClick: (
    selection: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null,
    e: React.SyntheticEvent,
  ) => void;
  xulswordStateHandler: React.Component<any, XulswordState>['setState'];
} & XulProps;

export type GenbookChooserState = RenderPromiseState & {
  expandedIDs: string[][];
};

export default class GenbookChooser
  extends React.Component<GenbookChooserProps, GenbookChooserState>
  implements RenderPromiseComponent
{
  treeNodes: Record<string, TreeNodeInfo[]>;

  treeRef: Record<string, React.RefObject<Tree>>;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  constructor(props: GenbookChooserProps) {
    super(props);
    const { panels } = props;

    this.state = {
      expandedIDs: panels.map(() => []),
      renderPromiseID: 0,
    };

    this.treeNodes = {};
    this.treeRef = {};

    this.expandKeyParents = this.expandKeyParents.bind(this);
    this.onNodeClick = this.onNodeClick.bind(this);
    this.scrollTo = this.scrollTo.bind(this);
    this.needsTreeParent = this.needsTreeParent.bind(this);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
  }

  componentDidMount() {
    const { props, renderPromise, scrollTo } = this;
    const { panels } = props;
    const firstGenbookKeyIndex = panels.findIndex(
      (m) => m && m in G.Tab && G.Tab[m].tabType === 'Genbks',
    );
    if (firstGenbookKeyIndex !== -1) {
      scrollTo(firstGenbookKeyIndex, undefined, 1000);
    }
    renderPromise.dispatch();
  }

  componentDidUpdate(prevProps: GenbookChooserProps) {
    const { props, renderPromise } = this;
    const { keys: prevkeys } = prevProps;
    const { keys } = props;
    const { scrollTo } = this;
    if (keys) {
      const firstChangedKeyIndex = keys.findIndex(
        (k, i) => (k && !prevkeys) || (k && prevkeys && k !== prevkeys[i]),
      );
      if (firstChangedKeyIndex !== -1) {
        scrollTo(firstChangedKeyIndex, { block: 'center', behavior: 'smooth' });
      }
    }
    renderPromise.dispatch();
  }

  onNodeClick(
    node: TreeNodeInfo,
    _nodePath: number[],
    e: React.MouseEvent<HTMLElement>,
  ) {
    const { onAudioClick } = this.props;
    if (
      'nodeData' in node &&
      node.nodeData &&
      !ofClass('bp6-tree-node-label', e.target)
    ) {
      onAudioClick(node.nodeData as AudioPlayerSelectionGB | null, e);
      e.stopPropagation();
    }
  }

  scrollTo(
    panelIndex: number,
    options?: ScrollIntoViewOptions,
    timeout?: number,
  ) {
    const { props, expandKeyParents, treeRef, loadingRef } = this;
    const { panels, keys } = props;
    const m = panels[panelIndex];
    const k = keys && keys[panelIndex];
    if (m && k) {
      const func = () => {
        const treekey = [m, panelIndex].join('.');
        if (treekey) {
          const elem = treeRef[treekey]?.current?.getNodeContentElement(k);
          if (elem && loadingRef.current) {
            safeScrollIntoView(
              elem,
              loadingRef.current,
              options || { block: 'center' },
            );
          }
        }
      };
      expandKeyParents(panelIndex);
      if (timeout) setTimeout(func, timeout);
      else func();
    }
  }

  needsTreeParent(panelIndex: number): boolean {
    const { props, treeNodes } = this;
    const { panels } = props;
    const treekey = [panels[panelIndex], panelIndex].join('.');
    return chooserGenbks(panels).length > 1 && treeNodes[treekey].length > 1;
  }

  // Expand parents of key nodes if they are collapsed.
  expandKeyParents(panelIndex: number) {
    const { props, state, treeNodes, needsTreeParent } = this;
    const { expandedIDs } = clone(state);
    const { panels, keys } = props;
    const module = panels[panelIndex];
    const key = keys && keys[panelIndex];
    const treekey = [module, panelIndex].join('.');
    const nodes = treeNodes[treekey];
    if (nodes && key) {
      const expanded: string[] = [];
      if (module && needsTreeParent(panelIndex)) {
        expanded.push(module);
      }
      const ancestors = gbAncestorIDs(key);
      if (ancestors) {
        ancestors.forEach((id) => expanded.push(id));
      }
      expandedIDs[panelIndex] = expanded;
      this.setState({ expandedIDs });
    }
  }

  render() {
    const {
      props,
      state,
      treeRef,
      treeNodes,
      renderPromise,
      loadingRef,
      onNodeClick,
      needsTreeParent,
    } = this;
    const { panels, keys, xulswordStateHandler } = props;
    const { expandedIDs } = state;

    const genbkPanels = chooserGenbks(panels);
    const treekeys = (groupIndex: number): [string | null, number] => {
      const [panelIndex] = genbkPanels[groupIndex];
      const module = panels[panelIndex];
      return [module, panelIndex];
    };

    // Build any treeNodes that have not been built yet. Each treekey has a
    // treeNode list, and is only built once and reused.
    genbkPanels.forEach((_group, i) => {
      const tks = treekeys(i);
      const treekey = tks.join('.');
      if (!treeNodes[treekey] || !treeNodes[treekey].length) {
        treeNodes[treekey] = [];
        const [m] = tks;
        const t = (m && m in G.Tab && G.Tab[m]) || null;
        if (m && t && t.type === C.GENBOOK) {
          const childNodes = GI.genBookTreeNodes([], renderPromise, m);
          if (childNodes.length) {
            forEachNode(childNodes, (node) =>
              // render Promise is not needed here, because audioGenBookNode()
              // only results in GI calls to GI.genBookTreeNodes, which must
              // already be cached in order to reach this point.
              audioGenBookNode(node, m, node.id.toString(), renderPromise),
            );
            treeNodes[treekey] = childNodes;
          }
          treeRef[treekey] = React.createRef();
        }
      }
    });

    return (
      <Vbox domref={loadingRef} {...addClass(`chooser genbook-chooser`, props)}>
        <Hbox className="fadetop" />

        <Hbox className="chooser-container" flex="20">
          <div className="scroll-parent">
            {genbkPanels.map((group, i) => {
              const [panelIndex] = group;
              const tks = treekeys(i);
              const treekey = tks.join('.');
              const [m] = tks;
              if (m) {
                const t = (m in G.Tab && G.Tab[m]) || null;
                let childNodes: TreeNodeInfo[] = treeNodes[treekey];
                // If there are multiple genbks in the chooser, each genbk root
                // node must have a single child.
                if (needsTreeParent(panelIndex)) {
                  childNodes = [
                    {
                      id: m,
                      label: t?.label || m,
                      className: t?.labelClass || 'cs-LTR_DEFAULT',
                      hasCaret: true,
                      childNodes,
                    },
                  ];
                }
                const key = (keys && keys[panelIndex]) || m;
                return (
                  <TreeView
                    key={stringHash(panelIndex, i, childNodes)}
                    initialState={childNodes}
                    selectedIDs={key ? [key] : []}
                    expandedIDs={expandedIDs[panelIndex]}
                    onSelection={(sel) => {
                      xulswordStateHandler(newState(panelIndex, sel));
                    }}
                    onExpansion={(exids) => {
                      this.setState((prevState) => {
                        const { expandedIDs: expIDs } = clone(prevState);
                        expIDs[panelIndex] = exids.map((d) => d.toString());
                        return { expandedIDs: expIDs };
                      });
                    }}
                    onNodeClick={onNodeClick}
                    treeRef={treeRef[treekey]}
                  />
                );
              }
              return null;
            })}
          </div>
        </Hbox>

        <Hbox flex="1" className="fadebot" />
      </Vbox>
    );
  }
}

// Return a function to update the xulsword keys state according to a given selection.
function newState(panelIndex: number, selection: Array<string | number>) {
  return (prevState: XulswordState) => {
    let { keys } = prevState;
    keys = keys.slice();
    if (selection[0]) keys[panelIndex] = selection[0].toString();
    return { keys };
  };
}
