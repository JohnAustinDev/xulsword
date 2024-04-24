
import type { SelectVKType } from "../renderer/libxul/selectVK";
import type { SelectORMType } from "../renderer/libxul/selectOR";
import type { OSISBookType } from "../type";

export type ChaplistVKType = { [bk in OSISBookType]?: [number, string][] }
export type ChaplistORType = [string, string, string][]; // [order, key, url]

export default function handleAction(type: string, id: string, ...args: any[]) {
  switch(type) {
    case 'bible_audio_Play': {
      const [selection, chaplist]
        = args as [SelectVKType, ChaplistVKType];
      // A Drupal selectVK item follows its associated audio player item.
      const player = document.getElementById(id)?.parentElement
        ?.previousElementSibling?.querySelector('audio') as HTMLAudioElement | undefined;
      if (player) {
        const { book, chapter } = selection;
        const chaparray = chaplist[book]?.find((ca) => ca[0] === chapter);
        if (chaparray) {
          player.setAttribute('src', chaparray[1].replace(/^base:/, ''));
          player.play().catch((_er) => {});
        }
      }
    }
    break;
    case 'genbk_audio_Play': {
      const [selection, chaplist] = args as [SelectORMType, ChaplistORType];
      // A Drupal selectOR item follows its associated audio player item.
      const player = document.getElementById(id)?.parentElement
        ?.previousElementSibling?.querySelector('audio') as HTMLAudioElement | undefined;
      if (player) {
        const { keys } = selection;
        const [key] = keys;
        const da = chaplist.find((x) => x[1] === key);
        if (da) {
          const url = da[2];
            player.setAttribute('src', url.replace(/^base:/, ''));
            player.play().catch((_er) => {});
        }
      }
    }
    break;
    default:
      throw new Error(`Unsupported action: '${type}'`);
  }
  return;
}

export function compressString(str: string) {
  const e: { [k: string]: number } = {};
  let f = str.split('');
  const d: (string | number)[] = [];
  let a: string = f[0];
  let g = 256;
  let c: string;
  for (let b = 1; b < f.length; b++) {
    c = f[b];
    if (null != e[a + c]) a += c;
    else {
      d.push(1 < a.length ? e[a] : a.charCodeAt(0));
      e[a + c] = g;
      g++;
      a = c;
    }
  }
  d.push(1 < a.length ? e[a] : a.charCodeAt(0));
  for (let b = 0; b < d.length; b++) {
    d[b] = String.fromCharCode(d[b] as number);
  }
  return d.join('');
}

export function decompressString(str: string) {
  let a: string;
  const e: { [k: string]: number | string } = {};
  const d = str.split('');
  let c: string = d[0];
  let f = d[0];
  const g = [c]
  const h = 256;
  let o = 256;
  for (let b = 1; b < d.length; b++) {
    const dbc = d[b].charCodeAt(0);
    a = h > dbc ? d[b] : e[dbc] ? e[dbc].toString() : f + c;
    g.push(a);
    c = a.charAt(0);
    e[o] = f + c;
    o++;
    f = a;
  }
  return g.join('');
}
