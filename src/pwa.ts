import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let reloadingForServiceWorkerUpdate = false;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForServiceWorkerUpdate) {
      return;
    }

    reloadingForServiceWorkerUpdate = true;
    window.location.reload();
  });
}

const applyUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    void applyUpdate(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    if (navigator.onLine) {
      void registration.update();
    }

    window.setInterval(() => {
      if (navigator.onLine) {
        void registration.update();
      }
    }, UPDATE_CHECK_INTERVAL_MS);
  },
});
