import { useEffect, useState } from 'react';

export function useFilePreview(file) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) return setUrl('');
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}
