import React from 'react';
import { bookmarkItemIconPath } from '../../../common.ts';
import G from '../../rg.ts';

import type { BookmarkItemType, BookmarkTreeNode } from '../../../type.ts';

export default function bookmarkItemIcon(
  item: BookmarkTreeNode | BookmarkItemType,
): JSX.Element {
  const path = bookmarkItemIconPath(G, item);
  return <img className="bmicon" src={G.inlineFile(path)} />;
}
