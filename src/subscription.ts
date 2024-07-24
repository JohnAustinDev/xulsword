import type { ContextMenuType } from './servers/app/contextMenu.ts';
import type { PrefCallbackType } from './prefs.ts';
import type { NewModulesType } from './type.ts';
import type { WindowRootState } from './clients/app/renderer.tsx';
import type { Socket } from 'socket.io-client';

// Publish callback opportunities to subscribers. To publish for subscribers
// in other processes, use G.publishSubscription in conjunctions with Subscribe.
// Subscribe may also be used to avoid dependency cycles.

// To add a new subscription option, add another key to subscriptionsNames and
// fixing the resulting TypeScript ESLint errors.
const subscriptionsNames: Record<keyof SubscriptionTypes, null> = {
  prefsChanged: null,
  windowCreated: null,
  modulesInstalled: null,
  asyncTaskComplete: null,
  resetMain: null,
  setRendererRootState: null,
};

type SubscriptionTypes = {
  prefsChanged: PrefCallbackType;
  windowCreated: ContextMenuType;
  modulesInstalled: (newmods: NewModulesType, callingWinID?: number) => void;
  asyncTaskComplete: () => unknown;
  resetMain: () => void;
  setRendererRootState: (state: Partial<WindowRootState>) => void;
};

export type SubscriptionType = {
  subscribe: {
    prefsChanged: (func: SubscriptionTypes['prefsChanged']) => () => void;
    modulesInstalled: (
      func: SubscriptionTypes['modulesInstalled'],
    ) => () => void;
    asyncTaskComplete: (
      func: SubscriptionTypes['asyncTaskComplete'],
    ) => () => void;
    windowCreated: (func: SubscriptionTypes['windowCreated']) => () => void;
    resetMain: (func: SubscriptionTypes['resetMain']) => () => void;
    setRendererRootState: (
      func: SubscriptionTypes['setRendererRootState'],
    ) => () => void;
  };

  publish: {
    prefsChanged: (
      ...args: Parameters<SubscriptionTypes['prefsChanged']>
    ) => Array<ReturnType<SubscriptionTypes['prefsChanged']>>;
    modulesInstalled: (
      ...args: Parameters<SubscriptionTypes['modulesInstalled']>
    ) => Array<ReturnType<SubscriptionTypes['modulesInstalled']>>;
    asyncTaskComplete: (
      ...args: Parameters<SubscriptionTypes['asyncTaskComplete']>
    ) => Array<ReturnType<SubscriptionTypes['asyncTaskComplete']>>;
    windowCreated: (
      ...args: Parameters<SubscriptionTypes['windowCreated']>
    ) => Array<ReturnType<SubscriptionTypes['windowCreated']>>;
    resetMain: (
      ...args: Parameters<SubscriptionTypes['resetMain']>
    ) => Array<ReturnType<SubscriptionTypes['resetMain']>>;
    setRendererRootState: (
      ...args: Parameters<SubscriptionTypes['setRendererRootState']>
    ) => Array<ReturnType<SubscriptionTypes['setRendererRootState']>>;
  };

  doSubscribe: (
    subscriptionName: string,
    callback: (...args: any[]) => unknown,
  ) => () => void;
  doPublish: (subscriptionName: string, ...args: any[]) => unknown[];
};

class SubscriptionClass implements SubscriptionType {
  subscribe;

  publish;

  store: Record<string, Array<(...args: any) => void>>;

  constructor() {
    const subscribe = {} as SubscriptionType['subscribe'];
    const publish = {} as SubscriptionType['publish'];
    const names = Object.keys(subscriptionsNames) as Array<
      keyof typeof subscriptionsNames
    >;
    names.forEach((sub) => {
      subscribe[sub] = (func: (...args: any[]) => unknown) => {
        return this.doSubscribe(sub, func);
      };
      publish[sub] = (...args: unknown[]): any => {
        return this.doPublish(sub, ...args);
      };
    });
    this.subscribe = subscribe;
    this.publish = publish;
    this.store = {};
  }

  // Register a callback for a subscription, and return a disposal
  // function to be called when the callback isn't needed any
  // longer (to prevent memory leaks).
  doSubscribe(
    subscriptionName: string,
    callback: (...args: unknown[]) => unknown,
  ) {
    if (!(subscriptionName in this.store)) this.store[subscriptionName] = [];
    this.store[subscriptionName].push(callback);
    return () => {
      this.store[subscriptionName] = this.store[subscriptionName].filter(
        (cb) => cb !== callback,
      );
    };
  }

  // Call any callback functions that have been registered for a
  // particular subscription.
  doPublish(subscriptionName: string, ...args: unknown[]): unknown[] {
    if (subscriptionName in this.store) {
      return this.store[subscriptionName].map((cb: any) => {
        const unk = cb(...args);
        return unk ?? null;
      });
    }
    return [];
  }
}

const Subscription = new SubscriptionClass() as SubscriptionType;

export default Subscription;
