const SERVICE_WORKER_URL = "/driver-service-worker-v2.js";
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;
const RESET_QUERY_PARAMETER = "__bb_pwa_reset";

let activeRegistration: ServiceWorkerRegistration | undefined;
let checkingForUpdate = false;
let reloadingForServiceWorkerUpdate = false;
let hadController =
  "serviceWorker" in navigator &&
  Boolean(navigator.serviceWorker.controller);

removeResetQueryParameter();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      if (!hadController) {
        hadController = true;
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

  void registerDriverServiceWorker();
}

async function registerDriverServiceWorker() {
  try {
    activeRegistration = await navigator.serviceWorker.register(
      SERVICE_WORKER_URL,
      {
        scope: "/",
        updateViaCache: "none",
      },
    );

    if (activeRegistration.waiting) {
      activeRegistration.waiting.postMessage({
        type: "SKIP_WAITING",
      });
    }

    activeRegistration.addEventListener("updatefound", () => {
      const installingWorker = activeRegistration?.installing;

      if (!installingWorker) {
        return;
      }

      installingWorker.addEventListener("statechange", () => {
        if (
          installingWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          installingWorker.postMessage({
            type: "SKIP_WAITING",
          });
        }
      });
    });

    await checkForDeploymentUpdate();

    window.setInterval(() => {
      void checkForDeploymentUpdate();
    }, UPDATE_CHECK_INTERVAL_MS);
  } catch (error) {
    console.error(
      "BayBlaze Driver service-worker registration failed.",
      error,
    );
  }
}

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

    if (activeRegistration.waiting) {
      activeRegistration.waiting.postMessage({
        type: "SKIP_WAITING",
      });
    }
  } catch (error) {
    console.error(
      "Unable to check for a BayBlaze Driver deployment update.",
      error,
    );
  } finally {
    checkingForUpdate = false;
  }
}

function removeResetQueryParameter() {
  const url = new URL(window.location.href);

  if (!url.searchParams.has(RESET_QUERY_PARAMETER)) {
    return;
  }

  url.searchParams.delete(RESET_QUERY_PARAMETER);

  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}
