self.addEventListener('push', function(event) {
  const data = event.data.json();
  const title = data.title || 'Notification';
  const options = {
    body: data.body,
    icon: data.icon || '/logo.jpg',
    badge: '/logo.jpg'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
