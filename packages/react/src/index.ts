import { useSyncExternalStore } from "react";

let tracking: Set<(fn: () => void) => () => void> | undefined;
let batching: Set<() => void> | undefined;

type Signal<T> = {
  value: T;
  useSignal: () => readonly [T, (newValue: T | ((newValue: T) => T)) => void];
};

type Computed<T> = {
  value: T;
  useComputed: () => T;
};

export function signal<T>(initialValue: T): Signal<T> {
  const listeners: Set<() => void> = new Set();

  const subscribe = (fn: () => void) => {
    listeners.add(fn);

    return () => {
      listeners.delete(fn);
    };
  };

  const proxy = new Proxy(
    { value: initialValue, useSignal },
    {
      get(target, key: "value" | "useSignal") {
        if (key === "value") {
          tracking?.add(subscribe);
          return target.value;
        }

        if (key === "useSignal") {
          return target.useSignal;
        }
      },
      set(target, key, value) {
        if (key !== "value") {
          return false;
        }

        target.value = value;

        if (batching) {
          for (const listener of listeners) {
            batching.add(listener);
          }

          return true;
        }

        for (const listener of listeners) {
          listener();
        }

        return true;
      },
    }
  );

  function useSignal() {
    const value = useSyncExternalStore(subscribe, () => proxy.value);
    return [
      value,
      (newValue: T | ((currentValue: T) => T)) => {
        proxy.value =
          newValue instanceof Function ? newValue(proxy.value) : newValue;
      },
    ] as const;
  }

  return proxy;
}

export function computed<T>(fn: () => T): Computed<T> {
  const listeners: Set<() => void> = new Set();

  const subscribe = (fn: () => void) => {
    listeners.add(fn);

    return () => {
      listeners.delete(fn);
    };
  };

  tracking = new Set();

  let value = fn();

  let batchedCount = 0;
  const targetBacthedCount = tracking.size - 1;

  for (const track of tracking) {
    track(() => {
      if (batching) {
        if (batchedCount === targetBacthedCount) {
          batchedCount = 0;
        } else {
          batchedCount += 1;
          return;
        }
      }

      value = fn();

      for (const listener of listeners) {
        listener();
      }
    });
  }

  tracking = undefined;

  const proxy = new Proxy(
    { value, useComputed },
    {
      get(target, key: "value" | "useComputed") {
        if (key === "value") {
          tracking?.add(subscribe);
          return value;
        }

        if (key === "useComputed") {
          return target.useComputed;
        }
      },
      set() {
        return false;
      },
    }
  );

  function useComputed() {
    return useSyncExternalStore(subscribe, () => proxy.value);
  }

  return proxy;
}

export function effect<T>(fn: () => T): void {
  tracking = new Set();

  fn();

  let currentBatchedCount = 0;
  const targetBacthedCount = tracking.size - 1;

  for (const track of tracking) {
    track(() => {
      if (batching) {
        if (currentBatchedCount === targetBacthedCount) {
          currentBatchedCount = 0;
        } else {
          currentBatchedCount += 1;
          return;
        }
      }

      fn();
    });
  }

  tracking = undefined;
}

export function batch<T>(fn: () => T): void {
  batching = new Set();

  fn();

  for (const listener of batching) {
    listener();
  }

  batching = undefined;
}

export function untracked<T>(fn: () => T): void {
  batching = new Set();

  fn();

  batching = undefined;
}
