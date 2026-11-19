import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export function PwaStatus() {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [swError, setSwError] = useState('');
  const { offlineReady: [offlineReady, setOfflineReady], needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError() { setSwError('Offline support could not start. Reload while connected to try again.'); },
  });
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const installed = () => setInstall(null);
    const syncOnline = () => setOnline(navigator.onLine);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('online', syncOnline); window.addEventListener('offline', syncOnline);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installed);
      window.removeEventListener('online', syncOnline); window.removeEventListener('offline', syncOnline);
    };
  }, []);

  async function requestInstall() {
    if (!install) return;
    setInstalling(true);
    try { await install.prompt(); await install.userChoice; setInstall(null); }
    catch { setSwError('Use your browser’s install menu to add RETREST.'); }
    finally { setInstalling(false); }
  }

  return <aside className="pwa-status stack" aria-label="App availability">
    {!online && <p className="notice" role="status">You’re offline. The app is available; account changes need a connection.</p>}
    {install && <button className="button button-quiet" onClick={requestInstall} disabled={installing}>Install RETREST</button>}
    {offlineReady && <div className="notice row" role="status"><span>Ready to open offline.</span><button className="button button-quiet" onClick={() => setOfflineReady(false)}>Dismiss</button></div>}
    {needRefresh && <div className="notice row" role="status"><span>A new version is ready. Save your changes first.</span><button className="button" onClick={() => void updateServiceWorker(true)}>Update app</button><button className="button button-quiet" onClick={() => setNeedRefresh(false)}>Later</button></div>}
    {swError && <p className="notice" role="status">{swError}</p>}
  </aside>;
}
