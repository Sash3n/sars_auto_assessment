import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { StoreProvider } from "@/lib/store/StoreProvider";

/** Render helper that provides the app store around a component. */
export function renderWithStore(ui: ReactElement) {
  return render(<StoreProvider>{ui}</StoreProvider>);
}
