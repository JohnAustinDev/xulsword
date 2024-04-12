
import type { ContextMenuType } from './main/contextMenu.ts';
import type { PrefCallbackType } from './main/components/prefs.ts';
import type { NewModulesType } from './type.ts';
import type { WindowRootState } from './renderer/renderer.tsx';

// Publish callback opportunities to subscribers. To publish for subscribers
// in other processes, use G.publishSubscription in conjunctions with Subscribe.
// Subscribe may also be used to avoid dependency cycles.

// To add a new subscription option, add another key to subscriptions, and
// to make it TypeScriptable, copy/paste/edit SubscriptionType.subscribe
// and SubscriptionType.publish.
const subscriptions = {
  prefsChanged: {} as PrefCallbackType,
  windowCreated: {} as ContextMenuType,
  modulesInstalled: {} as (
    newmods: NewModulesType,
    callingWinID?: number
  ) => void,
  asyncTaskComplete: {} as () => unknown,

  // These are subscribe once (used to avoid dependency cycles):
  resetMain: {} as () => void,
  setRendererRootState: {} as (state: Partial<WindowRootState>) => void,
};

export interface SubscriptionType {
  subscribe: {
    prefsChanged: (func: typeof subscriptions['prefsChanged']) => () => void;
    modulesInstalled: (
      func: typeof subscriptions['modulesInstalled']
    ) => () => void;
    asyncTaskComplete: (
      func: typeof subscriptions['asyncTaskComplete']
    ) => () => void;
    windowCreated: (func: typeof subscriptions['windowCreated']) => () => void;
    resetMain: (func: typeof subscriptions['resetMain']) => () => void;
    setRendererRootState: (
      func: typeof subscriptions['setRendererRootState']
    ) => () => void;
  };

  publish: {
    prefsChanged: (
      ...args: Parameters<typeof subscriptions['prefsChanged']>
    ) => ReturnType<typeof subscriptions['prefsChanged']>[];
    modulesInstalled: (
      ...args: Parameters<typeof subscriptions['modulesInstalled']>
    ) => ReturnType<typeof subscriptions['modulesInstalled']>[];
    asyncTaskComplete: (
      ...args: Parameters<typeof subscriptions['asyncTaskComplete']>
    ) => ReturnType<typeof subscriptions['asyncTaskComplete']>[];
    windowCreated: (
      ...args: Parameters<typeof subscriptions['windowCreated']>
    ) => ReturnType<typeof subscriptions['windowCreated']>[];
    resetMain: (
      ...args: Parameters<typeof subscriptions['resetMain']>
    ) => ReturnType<typeof subscriptions['resetMain']>[];
    setRendererRootState: (
      ...args: Parameters<typeof subscriptions['setRendererRootState']>
    ) => ReturnType<typeof subscriptions['setRendererRootState']>[];
  };

  doSubscribe: (
    subscriptionName: string,
    callback: (...args: any) => void
  ) => () => void;
  doPublish: (subscriptionName: string, ...args: any[]) => any[];
}

class SubscriptionClass implements SubscriptionType {
  subscribe;

  publish;

  store: { [i: string]: ((...args: any) => void)[] };

  constructor() {
    this.store = {};
    this.subscribe = subscriptions as any;
    this.publish = {} as any;
    Object.keys(subscriptions).forEach((sub) => {
      const nsub = this.subscribe as any;
      nsub[sub] = (func: any) => {
        return this.doSubscribe(sub, func);
      };
      this.publish[sub] = (...args: any) => {
        return this.doPublish(sub as any, ...args);
      };
    });
  }

  // Register a callback for a subscription, and return a disposal
  // function to be called when the callback isn't needed any
  // longer (to prevent memory leaks).
  doSubscribe(subscriptionName: string, callback: (...args: any) => void) {
    if (!(subscriptionName in this.store)) this.store[subscriptionName] = [];
    this.store[subscriptionName].push(callback);
    return () => {
      this.store[subscriptionName] = this.store[subscriptionName].filter(
        (cb) => cb !== callback
      );
    };
  }

  // Call any callback functions that have been registered for a
  // particular subscription.
  doPublish(subscriptionName: string, ...args: any[]) {
    if (subscriptionName in this.store) {
      return this.store[subscriptionName].map((cb) => {
        return cb(...args);
      });
    }
    return [];
  }
}

const Subscription = new SubscriptionClass() as SubscriptionType;

export default Subscription;
