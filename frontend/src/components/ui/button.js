import React from 'react';

export const Button = ({ children, ...props }) => {
  return (
    <button style={{ padding: '0.5rem 1rem', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '4px' }} {...props}>
      {children}
    </button>
  );
};
