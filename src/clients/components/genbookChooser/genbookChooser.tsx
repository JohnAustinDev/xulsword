import React from 'react';
import PropTypes from 'prop-types';
import { clone, gbAncestorIDs, stringHash } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import { audioGenBookNode } from '../../common.ts';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import { xulPropTypes, addClass } from '../libxul/xul.tsx';
import TreeView, { forEachNode } from '../libxul/treeview.tsx';
import '../chooser/chooser.css';
import './genbookChooser.css';

import type {
  GenBookAudioFile,
  VerseKeyAudioFile,
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
  onAudioClick: PropTypes.func.isRequired,
  xulswordStateHandler: PropTypes.func.isRequired,
};

export type GenbookChooserProps = {
  panels: Array<string | null>;
  keys: Array<string | undefined>;
  onAudioClick: (audio: VerseKeyAudioFile | GenBookAudioFile) => void;
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
      onAudioClick(node.nodeData as GenBookAudioFile);
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
    const { expandKeyParents, treeRef } = this;
    const m = panels[panelIndex];
    const k = keys[panelIndex];
    if (m && k) {
      const func = () => {
        const treekey = [m, panelIndex].join('.');
        treeRef[treekey]?.current
          ?.getNodeContentElement(k)
          ?.scrollIntoView(options || { block: 'center', behavior: 'auto' });
      };
      expandKeyParents(panelIndex);
      if (timeout) setTimeout(func, timeout);
      else func();
    }
  }

  // Expand parents of key nodes if they are collapsed.
  expandKeyParents(panelIndex: number) {
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
    const { panels, keys, xulswordStateHandler } = props;
    const { expandedIDs } = state;
    const { treeRef, treeNodes, renderPromise, loadingRef, onNodeClick } = this;

    const chooserGroups = genbks(panels);
    const treekeys = (groupIndex: number): [string | null, number] => {
      const [group] = chooserGroups[groupIndex];
      const m = panels[group];
      return [m, group];
    };

    // Build any treeNodes that have not been built yet. Each treekey has a
    // treeNode list, and is only built once and reused.
    chooserGroups.forEach((_group, i) => {
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
              // render Promise is not passed here, because audioGenBookNode()
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
            {chooserGroups.map((group, i) => {
              const tks = treekeys(i);
              const treekey = tks.join('.');
              const [m] = tks;
              if (m) {
                const t = (m in G.Tab && G.Tab[m]) || null;
                let childNodes: TreeNodeInfo[] = treeNodes[treekey];
                // If there are multiple genbks in the chooser, each genbk root
                // node must have a single child.
                if (chooserGroups.length > 1 && childNodes.length > 1) {
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
                const key = keys[group[0]] || m;
                return (
                  <TreeView
                    key={stringHash(childNodes)}
                    initialState={childNodes}
                    selectedIDs={key ? [key] : []}
                    expandedIDs={expandedIDs[i]}
                    onSelection={(sel) => {
                      xulswordStateHandler(newState(i, sel));
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

// Return groups of same-genbook-panels, in chooser order.
// Ex: [[0],[1,2]] or [[0,1,2]]
function genbks(panels: Array<string | null>): number[][] {
  const r: number[][] = [];
  panels.forEach((m, i) => {
    if (m && m in G.Tab && G.Tab[m].type === C.GENBOOK) {
      if (i > 0 && m === panels[i - 1]) {
        r[r.length - 1].push(i);
      } else {
        r.push([i]);
      }
    }
  });
  return r;
}

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
