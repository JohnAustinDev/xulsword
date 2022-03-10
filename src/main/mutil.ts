/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */

import { BrowserWindow } from 'electron';
import type { WindowArgType, WindowDescriptorType } from '../type';

export function jsdump(msg: string | Error) {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  )
    // eslint-disable-next-line no-console
    console.log(msg);
}

export const ElectronWindow: WindowDescriptorType[] = [];

// Return a list of BrowserWindow objects matching winargs. If winargs
// is a string, then caller BrowserWindow must be provided. If winargs
// is undefined or null, then caller will be returned. Otherwise an
// empty list is returned.
export function getBrowserWindows(
  winargs?: WindowArgType | null,
  caller?: BrowserWindow | null
): BrowserWindow[] {
  const windows: BrowserWindow[] = [];
  const testwin: Partial<WindowDescriptorType>[] = [];
  if (winargs === 'parent') {
    if (caller) {
      testwin.push(ElectronWindow[caller.getParentWindow().id]);
    }
  } else if (winargs === 'self') {
    if (caller) {
      testwin.push(ElectronWindow[caller.id]);
    }
  } else if (winargs === 'children') {
    if (caller)
      testwin.concat(
        caller.getChildWindows().map((w) => {
          return ElectronWindow[w.id];
        })
      );
  } else if (winargs && 'loadURL' in winargs) {
    windows.push(winargs);
  } else if (winargs) {
    testwin.push(winargs);
  } else if (caller) {
    windows.push(caller);
  }
  if (testwin.length) {
    BrowserWindow.getAllWindows().forEach((w) => {
      const keep = testwin.some((tw) => {
        return Object.entries(tw).every((entry) => {
          const p = entry[0] as keyof WindowDescriptorType;
          const v = entry[1] as any;
          return ElectronWindow[w.id][p] === v;
        });
      });
      if (keep) windows.push(w);
    });
  }
  return windows;
}
