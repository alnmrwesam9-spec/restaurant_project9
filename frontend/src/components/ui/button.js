import React from 'react';

export const Button = ({ children, style, ...props }) => {
  return (
    <button
      {...props}
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: 'var(--brand)',
        color: 'var(--brand-contrast)',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: '0.2s ease',
        ...style,
      }}
      onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
      onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
    >
      {children}
    </button>
  );
};
