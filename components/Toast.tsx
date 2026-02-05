'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

const ANIMATION_DURATION_MS = 200;

interface ToastProps {
  message: string;
  onCancel: () => void;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onCancel, onClose, duration = 5000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const isMountedRef = useRef(true);

  // Track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      if (isMountedRef.current) {
        onClose();
      }
    }, ANIMATION_DURATION_MS);
  }, [onClose]);

  const handleCancel = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      if (isMountedRef.current) {
        onCancel();
      }
    }, ANIMATION_DURATION_MS);
  }, [onCancel]);

  useEffect(() => {
    // Trigger fade in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#574a46',
        color: '#f5eae6',
        padding: '12px 20px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 4px 12px rgba(87, 74, 70, 0.3)',
        opacity: isVisible && !isExiting ? 1 : 0,
        transition: `opacity ${ANIMATION_DURATION_MS}ms ease-in-out`,
        zIndex: 1000,
      }}
    >
      <span>{message}</span>
      <button
        onClick={handleCancel}
        style={{
          backgroundColor: 'transparent',
          color: '#e893c2',
          border: '1px solid #e893c2',
          padding: '4px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(232, 147, 194, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        キャンセル
      </button>
    </div>
  );
}
