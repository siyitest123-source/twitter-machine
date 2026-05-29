"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Account } from "@/lib/schema";

type AccountContextValue = {
  accounts: Account[];
  currentId: number | null;
  current: Account | null;
  loading: boolean;
  setCurrentId: (id: number) => void;
  refresh: () => Promise<Account[]>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

const STORAGE_KEY = "factory.accountId";

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentId, setCurrentIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/accounts");
    const d = await r.json();
    const list: Account[] = d.accounts ?? [];
    setAccounts(list);
    return list;
  }, []);

  const setCurrentId = useCallback((id: number) => {
    setCurrentIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let stored: number | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      stored = raw ? Number(raw) : null;
    } catch {
      /* ignore */
    }
    refresh()
      .then((list) => {
        if (list.length === 0) {
          setCurrentIdState(null);
          return;
        }
        const valid = stored && list.some((a) => a.id === stored);
        setCurrentIdState(valid ? stored : list[0].id);
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  const current = useMemo(
    () => accounts.find((a) => a.id === currentId) ?? null,
    [accounts, currentId],
  );

  const value = useMemo(
    () => ({ accounts, currentId, current, loading, setCurrentId, refresh }),
    [accounts, currentId, current, loading, setCurrentId, refresh],
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
