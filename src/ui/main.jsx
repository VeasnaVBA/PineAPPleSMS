import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster, toast } from 'sonner';
import { Drawer } from 'vaul';
import 'sonner/dist/styles.css';
import './vaul.css';
import './styles.css';

// Ensure global UI namespace exists
window.UI = window.UI || {};

let triggerOpenDrawer = null;
let triggerCloseDrawer = null;
let pendingDrawerRequest = null;

// window.UI.toast(type, title, description)
window.UI.toast = (type, title, description) => {
  const opts = description ? { description } : {};
  if (type === 'success') {
    return toast.success(title, opts);
  }
  if (type === 'error') {
    return toast.error(title, opts);
  }
  if (type === 'info') {
    return toast.info(title, opts);
  }
  if (type === 'warning') {
    return toast.warning(title, opts);
  }
  return toast(title, opts);
};

// Shorthand helpers
window.UI.toast.success = (title, description) => window.UI.toast('success', title, description);
window.UI.toast.error = (title, description) => window.UI.toast('error', title, description);
window.UI.toast.info = (title, description) => window.UI.toast('info', title, description);
window.UI.toast.warning = (title, description) => window.UI.toast('warning', title, description);

// window.UI.drawer.open & close
window.UI.drawer = {
  open: ({ title, render }) => {
    if (triggerOpenDrawer) {
      triggerOpenDrawer({ title, render });
    } else {
      pendingDrawerRequest = { title, render };
    }
  },
  close: () => {
    if (triggerCloseDrawer) {
      triggerCloseDrawer();
    }
  }
};

function UIHost() {
  const [theme, setTheme] = useState(() => {
    return (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ? 'dark' : 'light';
  });

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [renderId, setRenderId] = useState(0);

  const containerRef = useRef(null);
  const renderFnRef = useRef(null);

  // Callback ref ensures render is called the moment the drawer container DOM node mounts
  const setContainerRef = useCallback((node) => {
    containerRef.current = node;
    if (node && renderFnRef.current) {
      node.innerHTML = '';
      try {
        renderFnRef.current(node);
      } catch (err) {
        console.error('Error rendering vanilla content in UI.drawer:', err);
      }
    }
  }, [renderId]);

  // Sync theme with document class (themeService adds/removes .dark on <html>)
  useEffect(() => {
    const syncTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Also check window.themeService subscription if initialized
    let unsubTheme = null;
    if (window.themeService?.subscribe) {
      unsubTheme = window.themeService.subscribe(({ theme: t }) => {
        setTheme(t === 'dark' ? 'dark' : 'light');
      });
    }

    return () => {
      observer.disconnect();
      if (unsubTheme) unsubTheme();
    };
  }, []);

  // Connect global drawer triggers
  useEffect(() => {
    triggerOpenDrawer = ({ title: newTitle, render }) => {
      setTitle(newTitle || '');
      renderFnRef.current = render || null;
      setRenderId((prev) => prev + 1);
      setIsOpen(true);
    };

    triggerCloseDrawer = () => {
      setIsOpen(false);
    };

    if (pendingDrawerRequest) {
      const req = pendingDrawerRequest;
      pendingDrawerRequest = null;
      triggerOpenDrawer(req);
    }

    return () => {
      triggerOpenDrawer = null;
      triggerCloseDrawer = null;
    };
  }, []);

  // Whenever drawer opens or renderId updates, fill the container with vanilla DOM content
  useEffect(() => {
    if (isOpen && containerRef.current && renderFnRef.current) {
      containerRef.current.innerHTML = '';
      try {
        renderFnRef.current(containerRef.current);
      } catch (err) {
        console.error('Error rendering vanilla content in UI.drawer:', err);
      }
    }
  }, [isOpen, renderId]);

  return (
    <>
      <Toaster
        theme={theme}
        position="top-right"
        richColors
        closeButton
        expand={false}
        toastOptions={{
          className: 'font-sans font-khmer text-xs shadow-lg border border-border',
        }}
      />

      <Drawer.Root
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            renderFnRef.current = null;
          }
        }}
        shouldScaleBackground={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="vaul-drawer-overlay" />
          <Drawer.Content className="vaul-drawer-content bg-card text-foreground border-t border-border">
            <div className="vaul-drawer-handle" />
            <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-border">
              <Drawer.Title className="text-base font-bold text-foreground font-khmer">
                {title}
              </Drawer.Title>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div
              ref={setContainerRef}
              className="drawer-body flex-1 overflow-y-auto p-4 sm:p-6"
              style={{ maxHeight: 'calc(92vh - 6rem)' }}
            />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

// Auto-mount React root
function mountHost() {
  let rootEl = document.getElementById('ui-react-root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'ui-react-root';
    document.body.appendChild(rootEl);
  }
  const root = createRoot(rootEl);
  root.render(<UIHost />);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHost);
  } else {
    mountHost();
  }
}
