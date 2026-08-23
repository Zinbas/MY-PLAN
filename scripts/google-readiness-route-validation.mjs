const baseUrl = process.env.MY_PLAN_TEST_BASE_URL || "http://127.0.0.1:3000";
const expectedMessage = "Google Calendar activation requires the app owner's Google OAuth credentials.";

const health = await fetch(`${baseUrl}/api/google/health`);
const readiness = await health.json();
if (health.status !== 200 || readiness.ready !== false || readiness.mode !== "setup-pending" || !String(readiness.message).includes("OAuth credentials")) {
  throw new Error(`Google readiness did not report safe setup-pending state: ${JSON.stringify({ status: health.status, readiness })}`);
}

const routes = ["/api/google/connect", "/api/google/sign-in", "/api/google/callback"];
const results = [];
for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
  const payload = await response.json();
  if (response.status !== 503 || payload.code !== "GOOGLE_OAUTH_NOT_CONFIGURED" || payload.message !== expectedMessage || !Array.isArray(payload.checklist)) {
    throw new Error(`Google route did not fail safely before credential activation: ${route} ${JSON.stringify({ status: response.status, payload })}`);
  }
  const serialized = JSON.stringify(payload).toLowerCase();
  if (serialized.includes("client-secret") || serialized.includes("refresh-token") || serialized.includes("authorization: bearer")) {
    throw new Error(`Google route disclosed a credential-shaped value: ${route}`);
  }
  results.push(`${route} safely returns 503 setup-pending`);
}

console.log(JSON.stringify({ passed: 4, results: ["safe Google readiness response", ...results] }, null, 2));
