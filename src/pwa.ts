import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

const applyUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    void applyUpdate(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    window.setInterval(() => {
      if (navigator.onLine) {
        void registration.update();
      }
    }, UPDATE_CHECK_INTERVAL_MS);
  },
});
