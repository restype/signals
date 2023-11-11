import { useSyncExternalStore } from "react";

let tracking: ((fn: () => void) => () => void)[] | undefined;
let batching: (() => void)[] | undefined;

export function createSignal<T>(initialValue: T) {
  const sig = signal(initialValue);

  const setSigValue = (newValue: T) => {
    sig.value = newValue;
  };

  const subscribe = sig.subscribe;
  const getSnapshot = () => sig.value;

  const useSignal = () => {
    const value = useSyncExternalStore(subscribe, getSnapshot);
    return [value, setSigValue] as const;
  };

  return { signal: () => [sig.value, setSigValue] as const, useSignal };
}

export function createComputed<T>(fn: () => T) {
  const sig = computed(fn);

  const subscribe = sig.subscribe;
  const getSnapshot = () => sig.value;

  const useComputed = () => {
    return useSyncExternalStore(subscribe, getSnapshot);
  };

  return { computed: () => sig.value, useComputed };
}

export function createEffect<T>(fn: () => T) {
  tracking = [];

  fn();

  for (const track of tracking) {
    track(() => {
      fn();
    });
  }

  tracking = undefined;
}

export function batch<T>(fn: () => T) {
  batching = [];

  fn();

  for (const listener of batching) {
    listener();
  }

  batching = undefined;
}

export function untracked<T>(fn: () => T) {
  batching = [];

  fn();

  batching = undefined;
}

function signal<T>(initialValue: T) {
  let listeners: (() => void)[] = [];

  const subscribe = (fn: () => void) => {
    listeners = [...listeners, fn];

    return () => {
      listeners = listeners.filter((it) => it !== fn);
    };
  };

  return new Proxy(
    { value: initialValue, subscribe },
    {
      get(target, key: "value" | "subscribe") {
        tracking?.push(subscribe);
        return target[key];
      },
      set(target, key, value) {
        if (key !== "value") {
          return false;
        }

        target.value = value;

        if (batching) {
          batching.push(...listeners);
          return true;
        }

        for (const listener of listeners) {
          listener();
        }

        return true;
      },
    }
  );
}

function computed<T>(fn: () => T) {
  let listeners: (() => void)[] = [];

  const subscribe = (fn: () => void) => {
    listeners = [...listeners, fn];

    return () => {
      listeners = listeners.filter((it) => it !== fn);
    };
  };

  tracking = [];

  const value = fn();

  const proxy = new Proxy(
    { value, subscribe },
    {
      get(target, key: "value" | "subscribe") {
        return target[key];
      },
    }
  );

  for (const track of tracking) {
    track(() => {
      proxy.value = fn();

      for (const listener of listeners) {
        listener();
      }
    });
  }

  tracking = undefined;

  return proxy;
}
