import Cache from '../../cache.ts';
import { repositoryKey } from '../../common.ts';
import { G } from '../G.ts';

import type { Repository } from "../../type.ts";

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
