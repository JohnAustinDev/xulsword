
import { JSON_stringify, callBatchThenCache } from "../common.ts";
import C from "../constant.ts";
import { GA } from "./rg";

import { GCallType } from "../type.ts";

export interface RenderPromiseComponent {
  renderPromise: RenderPromise;
}

export type RenderPromiseState = {
  renderPromiseID: number;
}

export default class RenderPromise {
  component: React.Component;

  calls = [] as GCallType[];

  uncacheableCalls = {} as {
    [key: string]: {
      promise: Promise<any>;
      resolved: any;
    };
  };

  constructor(component: React.Component) {
    this.component = component;
  }

  waiting(): boolean {
    return !!(this.calls.length || Object.keys(this.uncacheableCalls).length);
  }

  dispatch() {
    Object.entries(this.uncacheableCalls).forEach((entry) => {
      const [key, v] = entry;
      v.promise.then((r) => {
        this.uncacheableCalls[key].resolved = r;
        if (window.processR.XULSWORD_ENV() === 'development') {
          console.log(`Component reload: ${key}`);
        }
        this.component.setState({ renderPromiseID: Math.random() } as RenderPromiseState);
      });
    });

    // Add cacheable calls to global queue, wait a bit, then handle
    // them all-together.
    window.renderPromises.push(this);
    setTimeout(async () => {
      const calls: GCallType[] = [];
      const components: React.Component[] = [];
      const renders: (() => void)[] = [];
      window.renderPromises.forEach((rp) => {
        calls.concat(rp.calls);
        if (!components.find((c) => c === rp.component)) {
          components.push(rp.component);
          renders.push(() => {
            if (window.processR.XULSWORD_ENV() === 'development') {
              console.log(`Component reload: ${JSON_stringify(calls)}`);
            }
            rp.component.setState({ renderPromiseID: Math.random() } as RenderPromiseState);
          });
        }
      });
      window.renderPromises = [];
      if (calls.length) {
        await callBatchThenCache(GA, calls);
        renders.forEach((r) => r());
      }
    }, C.UI.Window.networkRequestBatchDelay);
  }
}
