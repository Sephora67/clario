import { useCallback, useEffect, useState } from "react";

/** Charge des données du compte et se recharge dès qu'un changement est enregistré. */
export function useLibrary<T>(fetcher: () => Promise<T>, initial: T, deps: unknown[] = []) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => fetcher().then((d) => { setData(d); setError(null); }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)), deps);
  useEffect(() => { void load(); window.addEventListener("clario-library", load); return () => window.removeEventListener("clario-library", load); }, [load]);
  return { data, loading, error, reload: load };
}
