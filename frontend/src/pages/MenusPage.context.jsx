// src/pages/MenusPage.context.js
import React, { createContext, useContext } from 'react';

export const MenusPageContext = createContext(null);

export function MenusProvider({ value, children }) {
  return <MenusPageContext.Provider value={value}>{children}</MenusPageContext.Provider>;
}

export function useMenusPage() {
  const ctx = useContext(MenusPageContext);
  if (!ctx) throw new Error('useMenusPage must be used inside <MenusProvider>');
  return ctx;
}
