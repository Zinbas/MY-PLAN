import { BellRing, Check, Clock3, ExternalLink, ShieldCheck, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { createMyPlanPushSubscription, removeMyPlanPushSubscription, webPushSupport } from "@/lib/webPush";
import { getNativeAndroidNotificationPermission, requestNativeAndroidNotificationToken } from "@/lib/nativeAppBridge";
import { isNativeAndroidMyPlanApp } from "@/lib/capacitorRuntime";
import type { PersonalReminderCandidate } from "@/lib/personalReminderEnrollment";
import "./reminderWorkspace.css";

type Props = { isAuthenticated: boolean; personalReminderCandidates: PersonalReminderCandidate[]; onSignIn: () => void; onOpenCalendar: () => void };
const leadOptions = [{ value: 0, label: "At start" }, { value: 10, label: "10 minutes before" }, { value: 30, label: "30 minutes before" }, { value: 60, label: "1 hour before" }, { value: 1440, label: "1 day before" }];
type DevicePermissionState = "checking" | "unsupported" | "default" | "granted" | "denied";

function permissionState(value: string): DevicePermissionState {
  if (value === "granted" || value === "denied") return value;
  if (value === "unsupported") return "unsupported";
  return "default";
}

export default function ReminderWorkspace({ isAuthenticated, personalReminderCandidates, onSignIn, onOpenCalendar }: Props) {
  const nativeAndroid = isNativeAndroidMyPlanApp();
  const readiness = trpc.push.readiness.useQuery();
  const preferences = trpc.push.preferences.useQuery(undefined, { enabled: isAuthenticated });
  const subscriptions = trpc.push.subscriptions.useQuery(undefined, { enabled: isAuthenticated });
  const nativeSubscriptions = trpc.push.nativeSubscriptions.useQuery(undefined, { enabled: isAuthenticated && nativeAndroid });
  const updatePreferences = trpc.push.updatePreferences.useMutation({ onSuccess: () => void preferences.refetch() });
  const subscribe = trpc.push.subscribe.useMutation({ onSuccess: () => { void preferences.refetch(); void subscriptions.refetch(); } });
  const subscribeNative = trpc.push.subscribeNative.useMutation({ onSuccess: () => { void preferences.refetch(); void nativeSubscriptions.refetch(); } });
  const disableAll = trpc.push.disableAll.useMutation({ onSuccess: () => { void preferences.refetch(); void subscriptions.refetch(); void nativeSubscriptions.refetch(); } });
  const unsubscribe = trpc.push.unsubscribe.useMutation({ onSuccess: () => void subscriptions.refetch() });
  const unsubscribeNative = trpc.push.unsubscribeNative.useMutation({ onSuccess: () => void nativeSubscriptions.refetch() });
  const enrollment = trpc.push.personalEnrollment.useQuery(undefined, { enabled: isAuthenticated });
  const syncPersonalEnrollment = trpc.push.syncPersonalEnrollment.useMutation({ onSuccess: () => void enrollment.refetch() });
  const clearPersonalEnrollment = trpc.push.clearPersonalEnrollment.useMutation({ onSuccess: () => void enrollment.refetch() });
  const [message, setMessage] = useState("");
  const [leadMinutes, setLeadMinutes] = useState(10);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:30");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [devicePermission, setDevicePermission] = useState<DevicePermissionState>("checking");

  useEffect(() => {
    if (nativeAndroid) {
      void getNativeAndroidNotificationPermission().then(value => setDevicePermission(permissionState(value))).catch(() => setDevicePermission("unsupported"));
      return;
    }
    if (!webPushSupport()) return setDevicePermission("unsupported");
    setDevicePermission(Notification.permission);
  }, [nativeAndroid]);

  useEffect(() => {
    if (!preferences.data) return;
    setLeadMinutes(preferences.data.defaultLeadMinutes);
    setQuietEnabled(Boolean(preferences.data.quietHoursStart && preferences.data.quietHoursEnd));
    setQuietStart(preferences.data.quietHoursStart || "22:30");
    setQuietEnd(preferences.data.quietHoursEnd || "07:00");
  }, [preferences.data]);

  const savePreferences = () => updatePreferences.mutate({ defaultLeadMinutes: leadMinutes, quietHoursStart: quietEnabled ? quietStart : null, quietHoursEnd: quietEnabled ? quietEnd : null, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null }, { onSuccess: () => setMessage("Reminder preferences saved."), onError: error => setMessage(error.message) });

  const enableDevice = async () => {
    if (!isAuthenticated) return onSignIn();
    try {
      if (nativeAndroid) {
        const token = await requestNativeAndroidNotificationToken();
        await subscribeNative.mutateAsync({ token, deviceLabel: "MY PLAN for Android" });
        setDevicePermission("granted");
        setMessage("MY PLAN securely registered this Android device. Delivery activates after the owner completes the Firebase server configuration; no test reminder was sent.");
        return;
      }
      if (!webPushSupport()) throw new Error("This browser does not support MY PLAN device reminders.");
      if (!readiness.data?.ready || !readiness.data.publicKey) throw new Error(readiness.data?.message || "Browser device reminders are being prepared.");
      const device = await createMyPlanPushSubscription(readiness.data.publicKey);
      await subscribe.mutateAsync({ ...device, userAgent: navigator.userAgent.slice(0, 512) });
      setDevicePermission("granted");
      setMessage("Device reminders are on for this browser. MY PLAN will use your timing and quiet-hours choices.");
    } catch (error) {
      if (nativeAndroid) void getNativeAndroidNotificationPermission().then(value => setDevicePermission(permissionState(value))).catch(() => undefined);
      else if (webPushSupport()) setDevicePermission(Notification.permission);
      setMessage(error instanceof Error ? error.message : "MY PLAN could not enable device reminders.");
    }
  };

  const turnOffEverywhere = async () => {
    if (!nativeAndroid) await removeMyPlanPushSubscription();
    await disableAll.mutateAsync();
    await clearPersonalEnrollment.mutateAsync();
    setMessage("MY PLAN device reminders, approved planning reminder copies, and saved device subscriptions were removed.");
  };

  const syncUpcomingPersonalItems = async () => {
    try {
      const result = await syncPersonalEnrollment.mutateAsync({ items: personalReminderCandidates });
      setMessage(`${result.activeCount} upcoming planning item${result.activeCount === 1 ? " is" : "s are"} available for this account’s device reminders. ${result.scheduledCount ? "Their reminder timing was refreshed." : "Nothing new needed scheduling."}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "MY PLAN could not update your device-reminder plan."); }
  };

  const enabled = Boolean(preferences.data?.enabled && (subscriptions.data?.length || nativeSubscriptions.data?.length));
  const canEnable = nativeAndroid ? devicePermission !== "unsupported" && devicePermission !== "denied" : Boolean(readiness.data?.ready && devicePermission !== "unsupported" && devicePermission !== "denied");
  const deviceLabel = nativeAndroid ? "This Android app" : "This browser";
  const status = devicePermission === "unsupported" ? "This device cannot receive MY PLAN reminders." : devicePermission === "denied" ? "Notifications are blocked for MY PLAN on this device." : nativeAndroid ? "Enable Android-style reminders when you are ready." : !readiness.data?.ready ? readiness.data?.message || "Browser device delivery is being prepared." : "Enable the reminders you asked for.";
  const pending = nativeAndroid ? subscribeNative.isPending : subscribe.isPending;

  return <section className="workspace-card reminder-workspace">
    <header className="reminder-heading"><div><p className="kicker"><BellRing size={15} /> Device reminders</p><h1>Helpful, even when closed.</h1><p>MY PLAN can send a quiet, branded system reminder after you explicitly allow it. You stay in control of timing, quiet hours, and every connected device.</p></div><div className={`reminder-seal ${enabled ? "is-enabled" : ""}`}><BellRing size={20} /><span>{enabled ? "On" : "Optional"}</span></div></header>
    {!isAuthenticated ? <section className="reminder-state"><ShieldCheck size={20} /><div><strong>Sign in to protect your device settings.</strong><span>Device registrations and off-app reminders are private to one MY PLAN account.</span></div><button className="accent" onClick={onSignIn}>Sign in <ExternalLink size={15} /></button></section> : null}
    {isAuthenticated ? <><section className={`reminder-permission is-${devicePermission}`}><div className="permission-icon"><Smartphone size={21} /></div><div><p className="kicker">{deviceLabel}</p><h2>{enabled ? "MY PLAN can remind you here." : status}</h2><p>{nativeAndroid ? "Android permission is requested only when you choose Enable Android reminders. FCM registration is encrypted on the server; no notification is sent during setup." : "MY PLAN asks for browser permission only after you choose Enable device reminders."}</p></div>{enabled ? <button className="reminder-disable" disabled={disableAll.isPending} onClick={() => void turnOffEverywhere()}><X size={15} /> Turn off everywhere</button> : devicePermission === "unsupported" || devicePermission === "denied" ? <span className="reminder-blocked">{devicePermission === "unsupported" ? "In-app reminders available" : "Permission blocked"}</span> : <button className="accent" disabled={!canEnable || pending} onClick={() => void enableDevice()}><BellRing size={15} /> {pending ? "Enabling…" : nativeAndroid ? "Enable Android reminders" : "Enable device reminders"}</button>}</section>
      <section className="reminder-preferences"><div className="list-progress-heading"><div><p className="kicker"><Clock3 size={14} /> Your delivery rules</p><h2>Gentle by default.</h2></div><span>Saved privately to your account</span></div><div className="reminder-control-grid"><label>Default timing<select value={leadMinutes} onChange={event => setLeadMinutes(Number(event.target.value))}>{leadOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>Contextual item timing, when chosen, overrides this default.</small></label><label className="quiet-toggle"><span><input type="checkbox" checked={quietEnabled} onChange={event => setQuietEnabled(event.target.checked)} /> Quiet hours</span><small>Hold reminders until your chosen quiet period ends.</small></label>{quietEnabled ? <div className="quiet-time-row"><label>Start<input type="time" value={quietStart} onChange={event => setQuietStart(event.target.value)} /></label><label>End<input type="time" value={quietEnd} onChange={event => setQuietEnd(event.target.value)} /></label></div> : null}</div><button className="reminder-save" disabled={updatePreferences.isPending} onClick={savePreferences}><Check size={15} /> {updatePreferences.isPending ? "Saving…" : "Save reminder rules"}</button></section>
      <section className="reminder-plan-enrollment"><div><p className="kicker"><ShieldCheck size={14} /> Your planning data, by choice</p><h2>Bring upcoming items to device reminders.</h2><p>When you choose Sync upcoming items, MY PLAN securely saves only an item’s title, time, type, selected lead, and destination for the next 120 days. It does not upload notes, courses, checklists, or other local workspace details.</p></div><div className="reminder-enrollment-summary"><strong>{personalReminderCandidates.length}</strong><span>upcoming item{personalReminderCandidates.length === 1 ? "" : "s"} available to sync</span>{enrollment.data?.activeCount ? <small>{enrollment.data.activeCount} currently approved for device reminders</small> : <small>No local planning items are stored for off-app delivery.</small>}</div><div className="reminder-enrollment-actions"><button className="accent" disabled={!enabled || syncPersonalEnrollment.isPending} onClick={() => void syncUpcomingPersonalItems()}><BellRing size={15} /> {syncPersonalEnrollment.isPending ? "Syncing…" : "Sync upcoming items"}</button>{enrollment.data?.activeCount ? <button disabled={clearPersonalEnrollment.isPending} onClick={() => void clearPersonalEnrollment.mutateAsync().then(() => setMessage("Upcoming local planning copies were removed. Your planner was not changed."))}>{clearPersonalEnrollment.isPending ? "Removing…" : "Remove planning copies"}</button> : null}</div>{!enabled ? <small className="reminder-enrollment-note">Enable this device first. MY PLAN will not copy local planning items before you do.</small> : null}</section>
      <section className="reminder-devices"><div><p className="kicker"><Smartphone size={14} /> Connected devices</p><h2>Your devices, your choice.</h2><p>Removing a device stops MY PLAN from delivering to it. Android delivery remains pending until the Firebase server credential is configured.</p></div>{subscriptions.data?.length || nativeSubscriptions.data?.length ? <ul>{subscriptions.data?.map(device => <li key={`web-${device.id}`}><span><b>{device.userAgent?.includes("Mobile") ? "Mobile browser" : "Browser device"}</b><small>{device.status} · added {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(device.createdAt))}</small></span><button onClick={() => unsubscribe.mutate({ subscriptionId: device.id })}>Remove</button></li>)}{nativeSubscriptions.data?.map(device => <li key={`android-${device.id}`}><span><b>{device.deviceLabel || "MY PLAN for Android"}</b><small>{device.status} · added {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(device.createdAt))}</small></span><button onClick={() => unsubscribeNative.mutate({ subscriptionId: device.id })}>Remove</button></li>)}</ul> : <div className="reminder-empty"><BellRing size={20} /><strong>No device is connected yet.</strong><p>Choose Enable device reminders above when you are ready.</p></div>}</section>
      {message ? <p className="reminder-message" role="status">{message}</p> : null}
      <aside className="reminder-note"><ShieldCheck size={17} /><span>MY PLAN asks only after you choose to enable reminders. It does not request permission on page load, and it never shares one user’s reminder content with another user.</span></aside>
    </> : null}
    <button className="account-link reminder-calendar-link" onClick={onOpenCalendar}>Use the in-app Notification Center <ExternalLink size={14} /></button>
  </section>;
}
