import { useSyncExternalStore } from "react";

let tracking: Set<(fn: () => void) => () => void> | undefined;
let batching: Set<() => void> | undefined;

type Signal<T> = {
  value: T;
  useSignal: () => readonly [
    T,
    (newValue: T | ((currentValue: T) => T)) => void
  ];
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

  let value = initialValue;

  const sig: Signal<T> = {
    get value() {
      tracking?.add(subscribe);
      return value;
    },
    set value(newValue: T) {
      value = newValue;

      if (batching) {
        for (const listener of listeners) {
          batching.add(listener);
        }

        return;
      }

      for (const listener of listeners) {
        listener();
      }
    },
    useSignal,
  };

  const getSnapshot = () => value;

  const setValue = (newValue: T | ((currentValue: T) => T)) => {
    sig.value = newValue instanceof Function ? newValue(value) : newValue;
  };

  function useSignal() {
    const reactValue = useSyncExternalStore(
      subscribe,
      getSnapshot,
      getSnapshot
    );

    return [reactValue, setValue] as const;
  }

  return sig;
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

  const getSnapshot = () => value;

  return {
    get value() {
      tracking?.add(subscribe);
      return value;
    },
    useComputed() {
      return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    },
  };
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
