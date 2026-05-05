import { ReactNode, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const main = mainRef.current;
    const targetHash = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';

    requestAnimationFrame(() => {
      if (targetHash) {
        const target = document.getElementById(targetHash);
        if (target) {
          target.scrollIntoView({ block: 'start', behavior: 'auto' });
          return;
        }
      }

      main?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      main?.focus({ preventScroll: true });
    });
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="flex bg-white min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        <main
          ref={mainRef}
          tabIndex={-1}
          aria-label="Workspace content"
          className="flex-1 overflow-y-auto bg-bg-secondary p-8 focus:outline-none"
        >
          <div className="max-w-[1440px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
