self.addEventListener("install", e => {
    self.skipWaiting();
});

self.addEventListener("activate", e => {
    console.log("Service Worker Activated");
});

self.addEventListener("push", e => {
    const data = e.data.json();

    self.registration.showNotification(data.title, {
        body: data.message,
        icon: "logo.png",
        badge: "logo.png"
    });
});
