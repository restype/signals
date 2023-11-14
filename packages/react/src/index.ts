import { useSyncExternalStore } from "react";

let tracking: ((fn: () => void) => () => void)[] | undefined;
let batching: (() => void)[] | undefined;

type Signal<T> = {
  signal: () => {
    value: T;
    setValue: (newValue: T) => void;
  };
  useSignal: () => readonly [T, (newValue: T) => void];
};

type Computed<T> = {
  computed: () => {
    value: T;
  };
  useComputed: () => T;
};

export function createSignal<T>(initialValue: T): Signal<T> {
  const sig = signal(initialValue);

  const useSignal = () => {
    const value = useSyncExternalStore(sig.subscribe, sig.getValue);
    return [value, sig.setValue] as const;
  };

  return {
    signal: () => ({
      value: sig.getValue(),
      setValue: sig.setValue,
    }),
    useSignal,
  };
}

export function createComputed<T>(fn: () => T): Computed<T> {
  const sig = computed(fn);

  const useComputed = () => {
    return useSyncExternalStore(sig.subscribe, sig.getValue);
  };

  return {
    computed: () => ({
      value: sig.getValue(),
    }),
    useComputed,
  };
}

export function createEffect<T>(fn: () => T): void {
  tracking = [];

  fn();

  for (const track of tracking) {
    track(() => {
      fn();
    });
  }

  tracking = undefined;
}

export function batch<T>(fn: () => T): void {
  batching = [];

  fn();

  for (const listener of batching) {
    listener();
  }

  batching = undefined;
}

export function untracked<T>(fn: () => T): void {
  batching = [];

  fn();

  batching = undefined;
}

function signal<T>(initialValue: T) {
  const listeners: Set<() => void> = new Set();

  const subscribe = (fn: () => void) => {
    listeners.add(fn);

    return () => {
      listeners.delete(fn);
    };
  };

  let value = initialValue;

  return {
    subscribe,
    getValue: () => {
      tracking?.push(subscribe);
      return value;
    },
    setValue: (newValue: T | ((currentValue: T) => T)) => {
      value = newValue instanceof Function ? newValue(value) : newValue;

      if (batching) {
        batching.push(...listeners);
        return;
      }

      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function computed<T>(fn: () => T) {
  const listeners: Set<() => void> = new Set();

  const subscribe = (fn: () => void) => {
    listeners.add(fn);

    return () => {
      listeners.delete(fn);
    };
  };

  tracking = [];

  let value = fn();

  for (const track of tracking) {
    track(() => {
      value = fn();

      for (const listener of listeners) {
        listener();
      }
    });
  }

  tracking = undefined;

  return {
    subscribe,
    getValue: () => value,
  };
}
