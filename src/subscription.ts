/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ContextMenuType } from './main/contextMenu';
import type { PrefCallbackType } from './main/components/prefs';
import type { NewModulesType } from './type';
import type { WindowRootState } from './renderer/renderer';

// To add a new subscription option, add another key to subscriptions, and
// to make it TypeScriptable, copy/paste/edit SubscriptionType.subscribe
// and SubscriptionsType.publish.
const subscriptions = {
  setPref: {} as PrefCallbackType,

  resetMain: {} as () => void,

  modulesInstalled: {} as (
    newmods: NewModulesType,
    callingWinID?: number
  ) => void,

  createWindow: {} as ContextMenuType,

  setWindowRootState: {} as (state: Partial<WindowRootState>) => void,
};

export interface SubscriptionType {
  subscribe: {
    setPref: (func: typeof subscriptions['setPref']) => () => void;
    resetMain: (func: typeof subscriptions['resetMain']) => () => void;
    modulesInstalled: (
      func: typeof subscriptions['modulesInstalled']
    ) => () => void;
    createWindow: (func: typeof subscriptions['createWindow']) => () => void;
    setWindowRootState: (
      func: typeof subscriptions['setWindowRootState']
    ) => () => void;
  };

  publish: {
    setPref: (
      ...args: Parameters<typeof subscriptions['setPref']>
    ) => ReturnType<typeof subscriptions['setPref']>[];
    resetMain: (
      ...args: Parameters<typeof subscriptions['resetMain']>
    ) => ReturnType<typeof subscriptions['resetMain']>[];
    modulesInstalled: (
      ...args: Parameters<typeof subscriptions['modulesInstalled']>
    ) => ReturnType<typeof subscriptions['modulesInstalled']>[];
    createWindow: (
      ...args: Parameters<typeof subscriptions['createWindow']>
    ) => ReturnType<typeof subscriptions['createWindow']>[];
    setWindowRootState: (
      ...args: Parameters<typeof subscriptions['setWindowRootState']>
    ) => ReturnType<typeof subscriptions['setWindowRootState']>[];
  };

  doPublish: (
    subscriptionName: keyof typeof subscriptions,
    ...args: Parameters<typeof subscriptions[keyof typeof subscriptions]>
  ) => ReturnType<typeof subscriptions[keyof typeof subscriptions]>[];
}

// Subscribe to and publish callback opportunities. It cannot be
// used to provide callbacks between processes, but it may be used
// to avoid dependency cycles. For multi-process publication
// functionality, use G.publishSubscription.
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
  doPublish(
    subscriptionName: keyof typeof subscriptions,
    ...args: Parameters<typeof subscriptions[keyof typeof subscriptions]>
  ) {
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
