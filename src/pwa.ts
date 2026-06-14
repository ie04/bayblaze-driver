import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

let activeRegistration: ServiceWorkerRegistration | undefined;
let checkingForUpdate = false;
let reloadingForServiceWorkerUpdate = false;
let hasServiceWorkerController =
  "serviceWorker" in navigator &&
  Boolean(navigator.serviceWorker.controller);

async function checkForDeploymentUpdate() {
  if (
    !activeRegistration ||
    !navigator.onLine ||
    checkingForUpdate
  ) {
    return;
  }

  checkingForUpdate = true;

  try {
    await activeRegistration.update();
  } catch (error) {
    console.error(
      "Unable to check for a BayBlaze Driver update.",
      error,
    );
  } finally {
    checkingForUpdate = false;
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      /*
       * Do not reload merely because the app was controlled for the
       * first time. Reload when an existing controller is replaced by
       * a newly deployed service worker.
       */
      if (!hasServiceWorkerController) {
        hasServiceWorkerController = true;
        return;
      }

      if (reloadingForServiceWorkerUpdate) {
        return;
      }

      reloadingForServiceWorkerUpdate = true;
      window.location.reload();
    },
  );

  window.addEventListener("focus", () => {
    void checkForDeploymentUpdate();
  });

  window.addEventListener("online", () => {
    void checkForDeploymentUpdate();
  });

  window.addEventListener("pageshow", () => {
    void checkForDeploymentUpdate();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void checkForDeploymentUpdate();
    }
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

    activeRegistration = registration;
    void checkForDeploymentUpdate();

    window.setInterval(() => {
      void checkForDeploymentUpdate();
    }, UPDATE_CHECK_INTERVAL_MS);
  },

  onRegisterError(error) {
    console.error(
      "BayBlaze Driver service-worker registration failed.",
      error,
    );
  },
});
