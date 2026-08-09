import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    // Check if app is launched in standalone mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      mediaQuery.addListener(handleMediaChange);
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  const installApp = async () => {
    // 1. Check if running inside an iframe (like AI Studio Preview)
    const isIframe = window.self !== window.top;
    if (isIframe) {
      alert(
        "💡 AI Studio Preview Notice:\n\n" +
        "Browsers block Progressive Web App (PWA) installation inside frames.\n\n" +
        "To install this app on your device:\n" +
        "1. Click the 'Open in New Tab' icon in the top-right corner of the AI Studio screen.\n" +
        "2. Once opened directly in a new browser tab, click 'Install App to Home Screen' from the profile menu there! 💕"
      );
      return;
    }

    // 2. Check if iOS device
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isiOS) {
      alert(
        "📲 iOS Safari PWA Installation Guide:\n\n" +
        "iOS Safari does not support automatic install popups. You can install it manually in 3 seconds:\n" +
        "1. Tap the browser's 'Share' button (a square with an up-arrow icon at the bottom center or top of Safari).\n" +
        "2. Scroll down the sharing menu list and tap 'Add to Home Screen' (with a plus icon).\n" +
        "3. Confirm the name and tap 'Add' to launch Piyaa as a full-screen, standalone native companion! 💕"
      );
      return;
    }

    // 3. Trigger native prompt if available
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsInstallable(false);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error('Error triggering PWA install prompt:', err);
      }
      return;
    }

    // 4. Fallback for other browsers/desktops
    alert(
      "📲 Progressive Web App (PWA) Installation Guide:\n\n" +
      "If the browser-native install prompt didn't show automatically, you can trigger installation manually:\n" +
      "• On Desktop (Chrome/Edge): Click the 'Install App' icon at the far right of your URL address bar (monitor with a down-arrow symbol).\n" +
      "• On Mobile (Android Chrome): Tap the three vertical dots menu in the top-right corner of the browser, and select 'Install app' or 'Add to Home screen'.\n\n" +
      "Once installed, you can launch Piyaa instantly from your device's Home Screen in glorious standalone, borderless native mode! 💕"
    );
  };

  return {
    isInstallable: !isStandalone,
    isStandalone,
    installApp
  };
}
