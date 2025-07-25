import React from 'react';
import PropTypes from 'prop-types';
import { Tree } from '@blueprintjs/core';
import C from '../../../constant.ts';
import { clone, diff } from '../../../common.ts';
import { xulPropTypes } from './xul.tsx';

import type { TreeEventHandler, TreeNodeInfo } from '@blueprintjs/core';
import type { XulProps } from './xul.tsx';
import { scrollIntoView } from '../../common.tsx';

// The initialState of all nodes in the tree is required. If selectedIDs is defined
// then onSelection must also be defined and the selection will be controlled by the
// parent. If expandedIDs is defined then onExpansion must also be defined and the
// expansion will be controlled by the parent. If enableMultipleSelection is false,
// then only one node will be selected at a time.
export type TreeViewProps = XulProps & {
  initialState: TreeNodeInfo[];
  enableMultipleSelection?: boolean;
  selectedIDs?: Array<string | number>;
  expandedIDs?: Array<string | number>;
  bpClassName?: string; // a BluePrint class for the Tree element
  onSelection?: (ids: Array<string | number>) => void;
  onExpansion?: (ids: Array<string | number>) => void;
  onNodeClick?: TreeEventHandler;
  treeRef?: React.RefObject<Tree>;
};

const propTypes = {
  ...xulPropTypes,
  initialState: PropTypes.arrayOf(PropTypes.any).isRequired,
  enableMultipleSelection: PropTypes.bool,
  selectedIDs: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  ),
  expandedIDs: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  ),
  bpClassName: PropTypes.string,
  onSelection: PropTypes.func,
  onExpansion: PropTypes.func,
  onNodeClick: PropTypes.func,
  treeRef: PropTypes.object,
};

type NodePath = number[];

type TreeAction =
  | {
      type: 'SET_IS_EXPANDED';
      payload: { path: NodePath; isExpanded: boolean };
    }
  | { type: 'DESELECT_ALL' }
  | {
      type: 'SET_IS_SELECTED';
      payload: { path: NodePath; isSelected: boolean };
    };

export function forEachNode(
  nodes: TreeNodeInfo[] | undefined,
  callback: (node: TreeNodeInfo) => void,
): TreeNodeInfo[] {
  if (nodes === undefined) {
    return [];
  }
  nodes.forEach((node) => {
    callback(node);
    forEachNode(node.childNodes, callback);
  });
  return nodes;
}

export function forNodeAtPath(
  nodes: TreeNodeInfo[],
  path: NodePath,
  callback: (node: TreeNodeInfo) => void,
): TreeNodeInfo {
  const nfp = Tree.nodeFromPath(path, nodes);
  callback(nfp);
  return nfp;
}

function treeReducer(state: TreeNodeInfo[], action: TreeAction) {
  switch (action.type) {
    case 'DESELECT_ALL': {
      const newState1 = [...state];
      forEachNode(newState1, (node) => {
        node.isSelected = false;
      });
      return newState1;
    }
    case 'SET_IS_SELECTED': {
      const newState3 = [...state];
      forNodeAtPath(newState3, action.payload.path, (node) => {
        node.isSelected = action.payload.isSelected;
      });
      return newState3;
    }
    case 'SET_IS_EXPANDED': {
      const newState2 = [...state];
      forNodeAtPath(newState2, action.payload.path, (node) => {
        node.isExpanded = action.payload.isExpanded;
      });
      return newState2;
    }
    default:
      return state;
  }
}

function getSelection(nodes?: TreeNodeInfo[]): Array<string | number> {
  const r: Array<string | number> = [];
  forEachNode(nodes, (node) => {
    if (node.isSelected) {
      r.push(node.id);
    }
  });
  return r;
}

function getExpansion(nodes?: TreeNodeInfo[]): Array<string | number> {
  const r: Array<string | number> = [];
  forEachNode(nodes, (node) => {
    if (node.isExpanded) {
      r.push(node.id);
    }
  });
  return r;
}

// Toggle/expand/collapse state of each id. If doExpand is null or
// undefined, state is toggled.
function updatedExpansion(
  nowExpandedIDs: Array<string | number>,
  idsx: Array<string | number> | string | number,
  doExpandx?: Array<boolean | null> | boolean | null,
) {
  const ids = Array.isArray(idsx) ? idsx : [idsx];
  const doExpand = (
    Array.isArray(doExpandx) ? doExpandx : ids.map(() => doExpandx)
  ).map((x) => x ?? null);
  const newExpandedIDs = clone(nowExpandedIDs);
  ids.forEach((idx, i) => {
    const doexp = doExpand[i];
    const id = idx.toString();
    const index = nowExpandedIDs.indexOf(id);
    if (index === -1 && (doexp || doexp === null)) {
      newExpandedIDs.push(id);
    } else if (index !== -1 && (doexp === false || doexp === null)) {
      newExpandedIDs.splice(index, 1);
    }
  });
  if (diff(nowExpandedIDs, newExpandedIDs)) {
    return newExpandedIDs;
  }
  return null;
}

function usePreviousSelection<V>(value: V) {
  const ref: React.MutableRefObject<V | undefined> = React.useRef();
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

function usePreviousExpansion<V>(value: V) {
  const ref: React.MutableRefObject<V | undefined> = React.useRef();
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

const TreeView = ({
  enableMultipleSelection = true,
  ...props
}: TreeViewProps) => {
  const {
    className,
    bpClassName,
    initialState,
    selectedIDs,
    expandedIDs,
    onSelection,
    onExpansion,
    onNodeClick,
    treeRef: treeRef0,
  } = props;
  const treeRef1: React.RefObject<Tree> = React.createRef();
  const treeRef = treeRef0 || treeRef1;

  const [nodes, dispatch] = React.useReducer(treeReducer, initialState);

  // Get current and previous selection and expansion.
  let selection: Array<string | number> = [];
  let expansion: Array<string | number> = [];
  if (selectedIDs) {
    let stop = false;
    forEachNode(nodes, (node) => {
      if (stop) node.isSelected = false;
      else {
        node.isSelected = selectedIDs.includes(node.id);
        if (node.isSelected) {
          selection.push(node.id);
          if (!enableMultipleSelection) stop = true;
        }
      }
    });
  } else selection = getSelection(nodes);
  if (expandedIDs) {
    forEachNode(nodes, (node) => {
      node.isExpanded = expandedIDs.includes(node.id);
      if (node.isExpanded) expansion.push(node.id);
    });
  } else expansion = getExpansion(nodes);
  const previousSelection = usePreviousSelection(selection);
  const previousExpansion = usePreviousExpansion(expansion);

  // On mount, scroll to selection
  React.useEffect(() => {
    setTimeout(() => {
      if (selection.length && treeRef.current) {
        const elem = treeRef.current.getNodeContentElement(selection[0]);
        if (elem) {
          const el = elem.getBoundingClientRect();
          if (el.top < 100 || el.bottom > window.innerHeight - 100) {
            let treeElem = elem.parentElement as HTMLElement;
            while (
              !treeElem.classList.contains('treeview') &&
              treeElem.parentElement
            ) {
              treeElem = treeElem.parentElement;
            }
            scrollIntoView(elem, treeElem, { block: 'center' });
          }
        }
      }
    }, C.UI.TreeScrollDelay);
  }, []);

  // Call onSelection and onExpansion when NOT controlled.
  React.useEffect(() => {
    if (
      !selectedIDs &&
      typeof onSelection === 'function' &&
      diff(previousSelection, selection)
    ) {
      onSelection(selection);
    }
  });
  React.useEffect(() => {
    if (
      !expandedIDs &&
      typeof onExpansion === 'function' &&
      diff(previousExpansion, expansion)
    ) {
      onExpansion(expansion);
    }
  });

  const handleNodeClick = React.useCallback(
    (
      node: TreeNodeInfo,
      nodePath: NodePath,
      e: React.MouseEvent<HTMLElement>,
    ) => {
      if (selectedIDs) {
        if (typeof onSelection === 'function') onSelection([node.id]);
        else
          throw new Error(
            `TreeView: onSelection must be defined when selectedIDs are defined`,
          );
      } else {
        const originallySelected = node.isSelected;
        if (!enableMultipleSelection || !e.shiftKey) {
          dispatch({ type: 'DESELECT_ALL' });
        }
        dispatch({
          payload: {
            path: nodePath,
            isSelected: originallySelected == null ? true : !originallySelected,
          },
          type: 'SET_IS_SELECTED',
        });
      }
      if (onNodeClick) onNodeClick(node, nodePath, e);
    },
    [selectedIDs, onSelection, onNodeClick, enableMultipleSelection],
  );

  const handleNodeCollapse = React.useCallback(
    (node: TreeNodeInfo, nodePath: NodePath) => {
      if (expandedIDs) {
        if (typeof onExpansion === 'function') {
          const newExpandedIDs = updatedExpansion(expandedIDs, node.id, false);
          if (newExpandedIDs) onExpansion(newExpandedIDs);
        } else
          throw new Error(
            `TreeView: onExpansion must be defined when expandedIDs are defined`,
          );
      } else {
        dispatch({
          payload: { path: nodePath, isExpanded: false },
          type: 'SET_IS_EXPANDED',
        });
      }
    },
    [expandedIDs, onExpansion],
  );

  // Call onExpansion if controlled, or else dispatch expansion to state.
  const handleNodeExpand = React.useCallback(
    (node: TreeNodeInfo, nodePath: NodePath) => {
      if (expandedIDs) {
        if (typeof onExpansion === 'function') {
          const newExpandedIDs = updatedExpansion(expandedIDs, node.id, true);
          if (newExpandedIDs) onExpansion(newExpandedIDs);
        } else
          throw new Error(
            `TreeView: onExpansion must be defined when expandedIDs are defined`,
          );
      } else {
        dispatch({
          payload: { path: nodePath, isExpanded: true },
          type: 'SET_IS_EXPANDED',
        });
      }
    },
    [expandedIDs, onExpansion],
  );

  const classes = ['treeview'];
  if (className) classes.push(className);
  if (bpClassName) classes.push(bpClassName);

  return (
    <Tree
      className={classes.join(' ')}
      contents={nodes}
      onNodeClick={handleNodeClick}
      onNodeCollapse={handleNodeCollapse}
      onNodeExpand={handleNodeExpand}
      ref={treeRef}
    />
  );
};
TreeView.propTypes = propTypes;

export default TreeView;
