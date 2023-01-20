/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable import/order */
import React from 'react';
import PropTypes from 'prop-types';
import C from '../../constant';
import G from '../rg';
import { Hbox, Vbox } from '../libxul/boxes';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  addClass,
} from '../libxul/xul';
import { TreeView } from '../libxul/treeview';
import './chooser.css';
import './genbookChooser.css';

import type { Tree, TreeNodeInfo } from '@blueprintjs/core';
import type { GenBookTOC, XulswordStateArgType } from 'type';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
  panels: PropTypes.arrayOf(PropTypes.string).isRequired,
  keys: PropTypes.arrayOf(PropTypes.string).isRequired,
  xulswordStateHandler: PropTypes.func.isRequired,
};

export interface GenbookChooserProps extends XulProps {
  panels: (string | null)[];
  keys: (string | undefined)[];
  xulswordStateHandler: (s: XulswordStateArgType) => void;
}

export interface GenbookChooserState {
  expandedIDs: string[];
}

class GenbookChooser extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  treeRef: React.RefObject<Tree>;

  constructor(props: GenbookChooserProps) {
    super(props);

    const s: GenbookChooserState = {
      expandedIDs: [],
    };
    this.state = s;

    this.treeRef = React.createRef();

    this.genBookNodes = this.genBookNodes.bind(this);
    this.getSelectedIDs = this.getSelectedIDs.bind(this);
    this.expandKeyParents = this.expandKeyParents.bind(this);
    this.key2ID = this.key2ID.bind(this);
  }

  componentDidMount() {
    const props = this.props as GenbookChooserProps;
    const { keys } = props;
    const { expandKeyParents, key2ID, treeRef } = this;
    expandKeyParents();
    const key = keys.find((k) => k);
    if (key) {
      setTimeout(
        () =>
          treeRef.current
            ?.getNodeContentElement(key2ID(key))
            ?.scrollIntoView({ block: 'center', behavior: 'auto' }),
        1000
      );
    }
  }

  componentDidUpdate(prevProps: GenbookChooserProps) {
    const props = this.props as GenbookChooserProps;
    const { keys } = props;
    const { keys: prevkeys } = prevProps;
    const { expandKeyParents, key2ID, treeRef } = this;
    const firstChangedKey = keys.find((k, i) => k && k !== prevkeys[i]);
    if (firstChangedKey) {
      expandKeyParents();
      treeRef.current
        ?.getNodeContentElement(key2ID(firstChangedKey))
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // Return the array of ids of each panel's selected key.
  getSelectedIDs() {
    const props = this.props as GenbookChooserProps;
    const { panels, keys } = props;
    return genbks(panels)
      .map((bga, i) => [i, keys[bga[0]]].join(C.GBKSEP))
      .filter(Boolean);
  }

  // Convert one of the keys to its ID in the chooser tree.
  key2ID(key: string): string {
    const props = this.props as GenbookChooserProps;
    const { panels, keys } = props;
    const p = keys.findIndex((k) => k === key);
    const i = genbks(panels).findIndex((x) => x.includes(p));
    return [i, key].join(C.GBKSEP);
  }

  // Expand parents of key nodes if they are collapsed.
  expandKeyParents() {
    const state = this.state as GenbookChooserState;
    const { expandedIDs } = state;
    const { getSelectedIDs, genBookNodes } = this;
    const expanded: Set<string> = new Set(expandedIDs);
    const originalSize = expanded.size;
    const nodes = genBookNodes();
    getSelectedIDs().forEach((id) => {
      const ancestors = getAncestors(nodes, id);
      if (ancestors) {
        ancestors.forEach((a) => expanded.add(a));
      }
    });
    if (expanded.size > originalSize)
      this.setState({ expandedIDs: Array.from(expanded) });
  }

  // Return a node set including all panel genbook TOCs.
  genBookNodes() {
    const props = this.props as GenbookChooserProps;
    const { panels } = props;

    // Create a TreeView node list for GenBooks.
    const nodes: TreeNodeInfo[] = [];
    const genbk = genbks(panels);
    genbk.forEach((x, i) => {
      const m = panels[x[0]];
      if (m) {
        const t = (m in G.Tab && G.Tab[m]) || null;
        if (t && t.type === C.GENBOOK) {
          const toc = G.LibSword.getGenBookTableOfContents(m);
          const topKeys = Object.keys(toc);
          if (
            genbk.length > 1 &&
            !(
              topKeys.length === 1 &&
              t?.label.toLocaleLowerCase() === topKeys[0].toLocaleLowerCase()
            )
          ) {
            nodes.push({
              id: m,
              label: t?.label || m,
              className: t?.labelClass || 'cs-locale',
              hasCaret: true,
              childNodes: toc2nodes(toc, m, `${i}`),
            });
          } else {
            nodes.push(...toc2nodes(toc, m, `${i}`));
          }
        }
      }
    });
    return nodes;
  }

  render() {
    const props = this.props as GenbookChooserProps;
    const state = this.state as GenbookChooserState;
    const { xulswordStateHandler } = props;
    const { expandedIDs } = state;
    const { genBookNodes, getSelectedIDs, treeRef } = this;

    return (
      <Vbox {...addClass(`chooser genbook-chooser`, props)}>
        <Hbox className="fadetop" />

        <Hbox className="chooser-container" flex="20">
          <div className="scroll-parent">
            <TreeView
              initialState={genBookNodes()}
              selectedIDs={getSelectedIDs()}
              expandedIDs={expandedIDs}
              onSelection={(sel) => xulswordStateHandler(newState(sel))}
              onExpansion={(exids) => this.setState({ expandedIDs: exids })}
              treeRef={treeRef}
            />
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

// Returns the ids of a node's ancestors.
function getAncestors(
  nodes: TreeNodeInfo[],
  id: string,
  ancesterNodes?: TreeNodeInfo[]
): string[] | null {
  const ancestors = ancesterNodes || [];
  let result: string[] | null = null;
  nodes.forEach((node) => {
    if (!result) {
      if (node.id === id) {
        result = ancestors.map((an) => an.id.toString());
      } else if (node.childNodes) {
        ancestors.push(node);
        const found = getAncestors(node.childNodes, id, ancestors);
        if (found !== null) result = found;
      }
    }
  });
  return result;
}

// Return a TreeView node list from a raw GenBook TOC object.
function toc2nodes(
  toc: GenBookTOC,
  module: string,
  parentID: string
): TreeNodeInfo[] {
  return Object.entries(toc).map((entry) => {
    const [key, val] = entry;
    const id = parentID ? [parentID, key].join(C.GBKSEP) : key;
    return {
      id,
      label: key,
      className: `cs-${module}`,
      hasCaret: val !== 1,
      childNodes: val !== 1 ? toc2nodes(val, module, id) : undefined,
    };
  });
}

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
function newState(selection: (string | number)[]): XulswordStateArgType {
  return (prevState) => {
    const genbk = genbks(prevState.panels);
    const keys = prevState.keys.slice();
    selection.forEach((selkey) => {
      const key = selkey.toString().split(C.GBKSEP);
      const i = Number(key.shift());
      if (!Number.isNaN(i)) {
        genbk[i].forEach((ix) => {
          keys[ix] = key.join(C.GBKSEP);
        });
      }
    });
    return { keys };
  };
}
