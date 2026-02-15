import api from '../services/api';

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
 
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
 
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const subscribeUser = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
            });
            
            await api.post('/notifications/subscribe', subscription);
            console.log('Subscribed to Push Notifications');
            return true;
        }
        return true; // Already subscribed
    } catch (error) {
        console.error('Failed to subscribe:', error);
        return false;
    }
};

export const checkNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notification");
    return 'unsupported';
  }

  if (Notification.permission === "granted") {
      await subscribeUser();
      return 'granted';
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        await subscribeUser();
    }
    return permission;
  }
  
  return 'denied';
};
