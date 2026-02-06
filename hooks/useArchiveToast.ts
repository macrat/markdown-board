import { useState, useCallback } from 'react';

interface ArchiveToastState {
  visible: boolean;
  pageId: string;
  pageTitle: string;
}

export function useArchiveToast() {
  const [toast, setToast] = useState<ArchiveToastState>({
    visible: false,
    pageId: '',
    pageTitle: '',
  });

  const showToast = useCallback((pageId: string, pageTitle: string) => {
    setToast({ visible: true, pageId, pageTitle });
  }, []);

  const hideToast = useCallback(() => {
    setToast({ visible: false, pageId: '', pageTitle: '' });
  }, []);

  return { toast, showToast, hideToast };
}
