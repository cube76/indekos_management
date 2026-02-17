self.addEventListener('push', function(event) {
  const data = event.data.json();
  const title = data.title || 'Notifikasi';
  const options = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: '/notification_badge.png'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
