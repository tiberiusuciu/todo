import { useEffect, useRef } from "react";
import { isClientOutdated } from "../lib/version";

function reloadGuardKey(clientVersion: string, serverVersion: string): string {
  return `version-reload:${clientVersion}->${serverVersion}`;
}

async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store", credentials: "omit" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export function useAppVersionCheck() {
  const clientVersion = __APP_VERSION__;
  const checkingRef = useRef(false);

  useEffect(() => {
    const checkVersion = async () => {
      if (document.visibilityState !== "visible") return;
      if (checkingRef.current) return;

      checkingRef.current = true;
      try {
        const serverVersion = await fetchServerVersion();
        if (!serverVersion || !isClientOutdated(clientVersion, serverVersion)) return;

        const key = reloadGuardKey(clientVersion, serverVersion);
        if (sessionStorage.getItem(key)) return;

        sessionStorage.setItem(key, "1");
        window.location.reload();
      } finally {
        checkingRef.current = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };

    const onFocus = () => {
      void checkVersion();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void checkVersion();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [clientVersion]);
}

function AppVersionGuard() {
  useAppVersionCheck();
  return null;
}

export { AppVersionGuard };
