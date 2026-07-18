"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import type { AppData, TaxYearData } from "@/lib/model/types";
import { emptyYear } from "@/lib/model/defaults";
import { initialAppData, storeReducer, type StoreAction } from "./reducer";
import { loadAppData, saveAppData } from "./storage";

interface StoreContextValue {
  state: AppData;
  dispatch: Dispatch<StoreAction>;
  /** False until the persisted state has been read after mount. */
  hydrated: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, undefined, initialAppData);
  const hydratedRef = useRef(false);

  // Persisted data loads after mount: the server render must match the
  // first client render, so it cannot read localStorage during render.
  useEffect(() => {
    dispatch({ type: "hydrate", data: loadAppData() });
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (hydratedRef.current) {
      saveAppData(state);
    }
  }, [state]);

  return (
    <StoreContext.Provider
      value={{ state, dispatch, hydrated: hydratedRef.current }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("useStore must be used inside StoreProvider");
  }
  return value;
}

/** The active tax year's data, created empty on first touch. */
export function useActiveYear(): TaxYearData {
  const { state } = useStore();
  return (
    state.years[state.activeTaxYearId] ?? emptyYear(state.activeTaxYearId)
  );
}
