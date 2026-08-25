import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import { initializeNativeAndroidBridge } from "./lib/nativeAppBridge";
import { isNativeAndroidMyPlanApp, myPlanApiOrigin } from "./lib/capacitorRuntime";
import { initializeNativeSessionHandoff, readNativeSessionToken } from "./lib/nativeSession";
import { registerMyPlanServiceWorker } from "./lib/webPush";
import "./index.css";
import "./motion.css";
import "./reminders.css";

const queryClient = new QueryClient();
let nativeSessionToken: string | null = null;

// Installability does not imply notification consent. Browser permission remains explicit-only.
void registerMyPlanServiceWorker().catch(() => undefined);

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError) || typeof window === "undefined") return;
  if (error.message === UNAUTHED_ERR_MSG) startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.query.state.error);
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.mutation.state.error);
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: isNativeAndroidMyPlanApp() ? `${myPlanApiOrigin()}/api/trpc` : "/api/trpc",
      transformer: superjson,
      headers() {
        if (nativeSessionToken) return { Authorization: `Bearer ${nativeSessionToken}` };
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          const prefix = `${COOKIE_NAME}=`;
          const token = raw?.split(";").find(value => value.trim().startsWith(prefix))?.trim().slice(prefix.length);
          return token ? { Authorization: `Bearer ${token}` } : {};
        } catch {
          return {};
        }
      },
      fetch(input, init) {
        return globalThis.fetch(input, { ...(init ?? {}), credentials: isNativeAndroidMyPlanApp() ? "omit" : "include" });
      },
    }),
  ],
});

async function bootstrapMyPlan() {
  if (isNativeAndroidMyPlanApp()) {
    nativeSessionToken = await readNativeSessionToken();
    await initializeNativeAndroidBridge();
    await initializeNativeSessionHandoff(token => {
      nativeSessionToken = token;
      void queryClient.invalidateQueries();
    });
  }
  createRoot(document.getElementById("root")!).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

void bootstrapMyPlan();
