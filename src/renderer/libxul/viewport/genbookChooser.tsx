/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable import/order */
import React from 'react';
import PropTypes from 'prop-types';
import { clone, genBookTreeNodes, gbAncestorIDs } from '../../../common.ts';
import C from '../../../constant.ts';
import G from '../../rg.ts';
import { audioGenBookNode } from '../../rutil.tsx';
import { Hbox, Vbox } from '../boxes.tsx';
import { xulDefaultProps, xulPropTypes, XulProps, addClass } from '../xul.tsx';
import TreeView, { forEachNode } from '../treeview.tsx';
import './chooser.css';
import './genbookChooser.css';

import type { Tree, TreeNodeInfo } from '@blueprintjs/core';
import type {
  GenBookAudioFile,
  VerseKeyAudioFile,
  XulswordStateArgType,
} from 'type';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
  panels: PropTypes.arrayOf(PropTypes.string).isRequired,
  keys: PropTypes.arrayOf(PropTypes.string).isRequired,
  onAudioClick: PropTypes.func.isRequired,
  xulswordStateHandler: PropTypes.func.isRequired,
};

export interface GenbookChooserProps extends XulProps {
  panels: (string | null)[];
  keys: (string | undefined)[];
  onAudioClick: (audio: VerseKeyAudioFile | GenBookAudioFile) => void;
  xulswordStateHandler: (s: XulswordStateArgType) => void;
}

export interface GenbookChooserState {
  expandedIDs: string[][];
}

class GenbookChooser extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  treeNodes: {
    [treekey: string]: TreeNodeInfo[];
  };

  treeRef: {
    [treekey: string]: React.RefObject<Tree>;
  };

  constructor(props: GenbookChooserProps) {
    super(props);
    const { panels } = props;

    const s: GenbookChooserState = {
      expandedIDs: panels.map(() => []),
    };
    this.state = s;

    this.treeNodes = {};
    this.treeRef = {};

    this.expandKeyParents = this.expandKeyParents.bind(this);
    this.onNodeClick = this.onNodeClick.bind(this);
    this.scrollTo = this.scrollTo.bind(this);
  }

  componentDidMount() {
    const props = this.props as GenbookChooserProps;
    const { panels } = props;
    const { scrollTo } = this;
    const firstGenbookKeyIndex = panels.findIndex(
      (m) => m && m in G.Tab && G.Tab[m].tabType === 'Genbks'
    );
    if (firstGenbookKeyIndex !== -1) {
      scrollTo(firstGenbookKeyIndex, undefined, 1000);
    }
  }

  componentDidUpdate(prevProps: GenbookChooserProps) {
    const { keys: prevkeys } = prevProps;
    const props = this.props as GenbookChooserProps;
    const { keys } = props;
    const { scrollTo } = this;
    const firstChangedKeyIndex = keys.findIndex(
      (k, i) => k && k !== prevkeys[i]
    );
    if (firstChangedKeyIndex !== -1) {
      scrollTo(firstChangedKeyIndex, { block: 'center', behavior: 'smooth' });
    }
  }

  onNodeClick(
    node: TreeNodeInfo,
    _nodePath: number[],
    e: React.MouseEvent<HTMLElement>
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
    timeout?: number
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
    const { treeRef, onNodeClick } = this;

    return (
      <Vbox {...addClass(`chooser genbook-chooser`, props)}>
        <Hbox className="fadetop" />

        <Hbox className="chooser-container" flex="20">
          <div className="scroll-parent">
            {genbks(panels).map((x, _i, a) => {
              const i = x[0];
              const m = panels[i];
              if (m) {
                const treekey = [m, i].join('.');
                const t = (m in G.Tab && G.Tab[m]) || null;
                if (t && t.type === C.GENBOOK) {
                  if (!(treekey in treeRef)) {
                    treeRef[treekey] = React.createRef();
                  }
                  const childNodes = genBookTreeNodes(
                    G.DiskCache,
                    G.LibSword,
                    m
                  );
                  const toc = G.LibSword.getGenBookTableOfContents(m);
                  const tocKeys = Object.keys(toc);
                  this.treeNodes[treekey] = [];
                  if (
                    a.length > 1 &&
                    !(
                      tocKeys.length === 1 &&
                      t?.label.toLocaleLowerCase() ===
                        tocKeys[0].toLocaleLowerCase()
                    )
                  ) {
                    this.treeNodes[treekey].push({
                      id: m,
                      label: t?.label || m,
                      className: t?.labelClass || 'cs-LTR_DEFAULT',
                      hasCaret: true,
                      childNodes,
                    });
                  } else {
                    this.treeNodes[treekey].push(...childNodes);
                  }
                  forEachNode(this.treeNodes[treekey], (node) =>
                    audioGenBookNode(node, m, node.id.toString())
                  );
                  const key = keys[i];
                  return (
                    <TreeView
                      key={[treekey].join('.')}
                      initialState={this.treeNodes[treekey]}
                      selectedIDs={key ? [key] : []}
                      expandedIDs={expandedIDs[i]}
                      onSelection={(sel) =>
                        xulswordStateHandler(newState(i, sel))
                      }
                      onExpansion={(exids) =>
                        this.setState((prevState: GenbookChooserState) => {
                          const { expandedIDs: expIDs } = clone(prevState);
                          expIDs[i] = exids.map((d) => d.toString());
                          return { expandedIDs: expIDs };
                        })
                      }
                      onNodeClick={onNodeClick}
                      treeRef={treeRef[treekey]}
                    />
                  );
                }
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
GenbookChooser.defaultProps = defaultProps;
GenbookChooser.propTypes = propTypes;

export default GenbookChooser;

// Return groups of same-genbook-panels, in chooser order.
// Ex: [[0],[1,2]] or [[0,1,2]]
function genbks(panels: (string | null)[]): number[][] {
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
  selection: (string | number)[]
): XulswordStateArgType {
  return (prevState) => {
    const { keys } = clone(prevState);
    if (selection[0]) keys[panelIndex] = selection[0].toString();
    return { keys };
  };
}
