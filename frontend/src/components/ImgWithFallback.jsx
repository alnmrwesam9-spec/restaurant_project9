// src/components/ImgWithFallback.jsx
import React, { useState } from 'react';

export default function ImgWithFallback({ src, fallback, alt = '', ...props }) {
  const [img, setImg] = useState(src || fallback || '');
  return (
    <img
      alt={alt}
      src={img || ''}
      onError={() => { if (fallback && img !== fallback) setImg(fallback); }}
      {...props}
    />
  );
}
