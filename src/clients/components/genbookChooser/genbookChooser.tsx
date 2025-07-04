import React from 'react';
import PropTypes from 'prop-types';
import { clone, gbAncestorIDs, stringHash } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import {
  audioGenBookNode,
  chooserGenbks,
  scrollIntoView,
} from '../../common.tsx';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import { xulPropTypes, addClass } from '../libxul/xul.tsx';
import TreeView, { forEachNode } from '../libxul/treeview.tsx';
import '../chooser/chooser.css';
import './genbookChooser.css';

import type {
  AudioPlayerSelectionGB,
  AudioPlayerSelectionVK,
  AudioPrefType,
  XulswordStateArgType,
} from '../../../type.ts';
import type { Tree, TreeNodeInfo } from '@blueprintjs/core';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { XulProps } from '../libxul/xul.tsx';

const propTypes = {
  ...xulPropTypes,
  panels: PropTypes.arrayOf(PropTypes.string).isRequired,
  keys: PropTypes.arrayOf(PropTypes.string).isRequired,
  audio: PropTypes.object.isRequired,
  onAudioClick: PropTypes.func.isRequired,
  xulswordStateHandler: PropTypes.func.isRequired,
};

export type GenbookChooserProps = {
  panels: Array<string | null>;
  keys: Array<string | undefined>;
  audio: AudioPrefType;
  onAudioClick: (
    selection: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null,
    e: React.SyntheticEvent,
  ) => void;
  xulswordStateHandler: (s: XulswordStateArgType) => void;
} & XulProps;

export type GenbookChooserState = RenderPromiseState & {
  expandedIDs: string[][];
};

class GenbookChooser extends React.Component implements RenderPromiseComponent {
  static propTypes: typeof propTypes;

  treeNodes: Record<string, TreeNodeInfo[]>;

  treeRef: Record<string, React.RefObject<Tree>>;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  constructor(props: GenbookChooserProps) {
    super(props);
    const { panels } = props;

    const s: GenbookChooserState = {
      expandedIDs: panels.map(() => []),
      renderPromiseID: 0,
    };
    this.state = s;

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
    const props = this.props as GenbookChooserProps;
    const { panels } = props;
    const { renderPromise, scrollTo } = this;
    const firstGenbookKeyIndex = panels.findIndex(
      (m) => m && m in G.Tab && G.Tab[m].tabType === 'Genbks',
    );
    if (firstGenbookKeyIndex !== -1) {
      scrollTo(firstGenbookKeyIndex, undefined, 1000);
    }
    renderPromise.dispatch();
  }

  componentDidUpdate(prevProps: GenbookChooserProps) {
    const { renderPromise } = this;
    const { keys: prevkeys } = prevProps;
    const props = this.props as GenbookChooserProps;
    const { keys } = props;
    const { scrollTo } = this;
    const firstChangedKeyIndex = keys.findIndex(
      (k, i) => k && k !== prevkeys[i],
    );
    if (firstChangedKeyIndex !== -1) {
      scrollTo(firstChangedKeyIndex, { block: 'center', behavior: 'smooth' });
    }
    renderPromise.dispatch();
  }

  onNodeClick(
    node: TreeNodeInfo,
    _nodePath: number[],
    e: React.MouseEvent<HTMLElement>,
  ) {
    const props = this.props as GenbookChooserProps;
    const { onAudioClick } = props;
    if ('nodeData' in node) {
      onAudioClick(node.nodeData as AudioPlayerSelectionGB | null, e);
      e.stopPropagation();
    }
  }

  scrollTo(
    panelIndex: number,
    options?: ScrollIntoViewOptions,
    timeout?: number,
  ) {
    const props = this.props as GenbookChooserProps;
    const { panels, keys } = props;
    const { expandKeyParents, treeRef, loadingRef } = this;
    const m = panels[panelIndex];
    const k = keys[panelIndex];
    if (m && k) {
      const func = () => {
        const treekey = [m, panelIndex].join('.');
        if (treekey) {
          const elem = treeRef[treekey]?.current?.getNodeContentElement(k);
          if (elem && loadingRef.current) {
            scrollIntoView(
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
    const { treeNodes } = this;
    const props = this.props as GenbookChooserProps;
    const { panels } = props;
    const treekey = [panels[panelIndex], panelIndex].join('.');
    return chooserGenbks(panels).length > 1 && treeNodes[treekey].length > 1;
  }

  // Expand parents of key nodes if they are collapsed.
  expandKeyParents(panelIndex: number) {
    const { needsTreeParent } = this;
    const state = this.state as GenbookChooserState;
    const { expandedIDs } = clone(state);
    const props = this.props as GenbookChooserProps;
    const { panels, keys } = props;
    const { treeNodes } = this;
    const module = panels[panelIndex];
    const key = keys[panelIndex];
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
    const props = this.props as GenbookChooserProps;
    const state = this.state as GenbookChooserState;
    const { panels, keys, audio, xulswordStateHandler } = props;
    const { expandedIDs } = state;
    const {
      treeRef,
      treeNodes,
      renderPromise,
      loadingRef,
      onNodeClick,
      needsTreeParent,
    } = this;
    const { defaults } = audio;

    const genbkPanels = chooserGenbks(panels);
    const treekeys = (groupIndex: number): [string | null, number] => {
      const [group] = genbkPanels[groupIndex];
      const m = panels[group];
      return [m, group];
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
              audioGenBookNode(
                node,
                m,
                node.id.toString(),
                defaults,
                renderPromise,
              ),
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
                const key = keys[panelIndex] || m;
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
                      this.setState((prevState: GenbookChooserState) => {
                        const { expandedIDs: expIDs } = clone(prevState);
                        expIDs[i] = exids.map((d) => d.toString());
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
GenbookChooser.propTypes = propTypes;

export default GenbookChooser;

// Return a function to update the xulsword keys state according to a given selection.
function newState(
  panelIndex: number,
  selection: Array<string | number>,
): XulswordStateArgType {
  return (prevState) => {
    const { keys } = clone(prevState);
    if (selection[0]) keys[panelIndex] = selection[0].toString();
    return { keys };
  };
}
