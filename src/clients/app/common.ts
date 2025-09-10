import Cache from '../../cache.ts';
import {
  forEachBookmarkItem,
  localizeBookmark,
  repositoryKey,
} from '../../common.ts';
import { GE as G } from '../G.ts';
import RenderPromise from '../renderPromise.ts';
import { getSampleText } from '../bookmarks.tsx';

import type { BookmarkFolderType, Repository } from '../../type.ts';

export function isRepoBuiltIn(repo: Repository | string): boolean {
  const repokey = typeof repo === 'object' ? repositoryKey(repo) : repo;
  const cachekey = ['isBuiltIn', repokey];
  if (!Cache.has(...cachekey)) {
    const biRepoKeys = G.BuiltInRepos.map((r) => repositoryKey(r));
    const result: boolean = biRepoKeys.includes(repokey);
    Cache.write(result, ...cachekey);
  }
  return Cache.read(...cachekey);
}

// Recursively apply localization, and optionally add sampleText, to a folder.
export function localizeBookmarks(
  folder: BookmarkFolderType,
  renderPromise: RenderPromise,
  getSampleTextFunc?: typeof getSampleText,
) {
  localizeBookmark(folder, renderPromise);
  forEachBookmarkItem(folder.childNodes, (item) => {
    localizeBookmark(item, renderPromise);
    if (
      getSampleTextFunc &&
      item.type === 'bookmark' &&
      !item.sampleText &&
      item.location
    ) {
      item.sampleText = getSampleTextFunc(item.location);
    }
  });
}
