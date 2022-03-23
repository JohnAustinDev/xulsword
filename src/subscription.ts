/* eslint-disable @typescript-eslint/no-explicit-any */

// Subscribe to and publish callback opportunities. It cannot be used to provide callbacks
// between processes, but it may be used to avoid dependency cycles. For similar multi-
// process functionality, use IPC.
const Subscription = {
  subscriptions: {} as { [i: string]: ((...args: any) => void)[] },

  // Register a callback for a subscription, and return a disposal function
  // to be called then the callback isn't needed any longer (to prevent memory
  // leaks).
  subscribe(subscriptionName: string, callback: (...args: any) => void) {
    if (!(subscriptionName in this.subscriptions))
      this.subscriptions[subscriptionName] = [];
    this.subscriptions[subscriptionName].push(callback);
    return () => {
      this.subscriptions[subscriptionName] = this.subscriptions[
        subscriptionName
      ].filter((cb) => cb !== callback);
    };
  },

  // Call any callback functions that have been registered for a particular
  // subscription.
  publish(subscriptionName: string, ...args: any) {
    if (subscriptionName in this.subscriptions) {
      this.subscriptions[subscriptionName].forEach((cb) => {
        cb(...args);
      });
    }
  },
};

export default Subscription;
