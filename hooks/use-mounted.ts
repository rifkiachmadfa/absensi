import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * True setelah komponen mount di client. Dipakai untuk menghindari mismatch
 * hydration pada komponen yang bergantung pada state client-only (mis. tema
 * dari next-themes), tanpa memanggil setState di dalam useEffect.
 */
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}