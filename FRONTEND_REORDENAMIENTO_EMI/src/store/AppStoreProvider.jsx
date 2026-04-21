import { createContext, useContext, useMemo, useReducer } from "react";

const AppStoreContext = createContext(null);

const initialState = {
  user: null,
  isAuthenticated: false,
  sidebarOpen: true,
};

function appStoreReducer(state, action) {
  switch (action.type) {
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
        isAuthenticated: Boolean(action.payload),
      };
    case "LOGOUT":
      return {
        ...state,
        user: null,
        isAuthenticated: false,
      };
    case "TOGGLE_SIDEBAR":
      return {
        ...state,
        sidebarOpen: !state.sidebarOpen,
      };
    default:
      return state;
  }
}

export function AppStoreProvider({ children }) {
  const [state, dispatch] = useReducer(appStoreReducer, initialState);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      setUser: (user) => dispatch({ type: "SET_USER", payload: user }),
      logout: () => dispatch({ type: "LOGOUT" }),
      toggleSidebar: () => dispatch({ type: "TOGGLE_SIDEBAR" }),
    }),
    [state]
  );

  return (
    <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppStoreContext);

  if (!context) {
    throw new Error("useAppStore must be used within AppStoreProvider");
  }

  return context;
}
