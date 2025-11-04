// src/hooks/useLocalStorage.js
import { useEffect, useState } from 'react';
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initialValue; }
    catch { return initialValue; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}
