import { BellRing, Check, Clock3, ExternalLink, ShieldCheck, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { createMyPlanPushSubscription, getMyPlanPushSubscription, removeMyPlanPushSubscription, type SerializablePushSubscription, webPushSupport } from "@/lib/webPush";
import { deviceReminderAccessStatus, type DeviceConnectionState, type DevicePermissionState } from "@/lib/deviceReminderStatus";
import type { PersonalReminderCandidate } from "@/lib/personalReminderEnrollment";
import type { InAppReminderSettings } from "@/lib/inAppReminders";
import "./reminderWorkspace.css";

type Props = { isAuthenticated: boolean; personalReminderCandidates: PersonalReminderCandidate[]; inAppReminderSettings: InAppReminderSettings; onUpdateInAppReminderSettings: (settings: InAppReminderSettings) => void; onSignIn: () => void; onOpenCalendar: () => void };
const leadOptions = [{ value: 0, label: "At start" }, { value: 10, label: "10 minutes before" }, { value: 30, label: "30 minutes before" }, { value: 60, label: "1 hour before" }, { value: 1440, label: "1 day before" }];
export default function ReminderWorkspace({ isAuthenticated, personalReminderCandidates, inAppReminderSettings, onUpdateInAppReminderSettings, onSignIn, onOpenCalendar }: Props) {
  const readiness = trpc.push.readiness.useQuery();
  const preferences = trpc.push.preferences.useQuery(undefined, { enabled: isAuthenticated });
  const subscriptions = trpc.push.subscriptions.useQuery(undefined, { enabled: isAuthenticated });
  const [browserSubscription, setBrowserSubscription] = useState<SerializablePushSubscription | null>(null);
  const currentDevice = trpc.push.currentDevice.useQuery({ endpoint: browserSubscription?.endpoint || "https://my-plan.invalid/no-browser-subscription" }, { enabled: Boolean(isAuthenticated && browserSubscription) });
  const updatePreferences = trpc.push.updatePreferences.useMutation({ onSuccess: () => void preferences.refetch() });
  const subscribe = trpc.push.subscribe.useMutation({ onSuccess: () => { void preferences.refetch(); void subscriptions.refetch(); } });
  const disableAll = trpc.push.disableAll.useMutation({ onSuccess: () => { void preferences.refetch(); void subscriptions.refetch(); } });
  const unsubscribe = trpc.push.unsubscribe.useMutation({ onSuccess: () => void subscriptions.refetch() });
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
    let active = true;
    const readBrowserAccess = async () => {
      if (!webPushSupport()) { if (active) setDevicePermission("unsupported"); return; }
      if (active) setDevicePermission(Notification.permission);
      try {
        const subscription = await getMyPlanPushSubscription();
        if (active) setBrowserSubscription(subscription);
      } catch {
        if (active) setBrowserSubscription(null);
      }
    };
    void readBrowserAccess();
    window.addEventListener("focus", readBrowserAccess);
    return () => { active = false; window.removeEventListener("focus", readBrowserAccess); };
  }, []);

  useEffect(() => {
    if (!preferences.data) return;
    setLeadMinutes(preferences.data.defaultLeadMinutes);
    setQuietEnabled(Boolean(preferences.data.quietHoursStart && preferences.data.quietHoursEnd));
    setQuietStart(preferences.data.quietHoursStart || "22:30");
    setQuietEnd(preferences.data.quietHoursEnd || "07:00");
  }, [preferences.data]);

  const savePreferences = () => updatePreferences.mutate({
    defaultLeadMinutes: leadMinutes,
    quietHoursStart: quietEnabled ? quietStart : null,
    quietHoursEnd: quietEnabled ? quietEnd : null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  }, { onSuccess: () => setMessage("Reminder preferences saved."), onError: error => setMessage(error.message) });

  const enableDevice = async () => {
    if (!isAuthenticated) return onSignIn();
    if (!webPushSupport()) {
      setDevicePermission("unsupported");
      return setMessage("This browser does not support MY PLAN device reminders. You can still use the in-app Notification Center.");
    }
    if (!readiness.data?.ready || !readiness.data.publicKey) return setMessage(readiness.data?.message || "Device reminders are being prepared.");
    try {
      setMessage(Notification.permission === "default" ? "Your browser will now ask for notification permission." : "Connecting this browser to your MY PLAN account…");
      const device = await createMyPlanPushSubscription(readiness.data.publicKey);
      await subscribe.mutateAsync({ ...device, userAgent: navigator.userAgent.slice(0, 512) });
      setBrowserSubscription(device);
      setDevicePermission("granted");
      setMessage("Notifications are allowed. MY PLAN is confirming that this browser is connected to your account.");
    } catch (error) {
      if (webPushSupport()) setDevicePermission(Notification.permission);
      setMessage(error instanceof Error ? error.message : "MY PLAN could not enable device reminders.");
    }
  };

  const turnOffEverywhere = async () => {
    await removeMyPlanPushSubscription();
    await disableAll.mutateAsync();
    await clearPersonalEnrollment.mutateAsync();
    setBrowserSubscription(null);
    setMessage("MY PLAN device reminders, approved planning reminder copies, and saved device subscriptions were removed.");
  };

  const syncUpcomingPersonalItems = async () => {
    try {
      const result = await syncPersonalEnrollment.mutateAsync({ items: personalReminderCandidates });
      setMessage(`${result.activeCount} upcoming planning item${result.activeCount === 1 ? " is" : "s are"} available for this account’s device reminders. ${result.scheduledCount ? "Their reminder timing was refreshed." : "Nothing new needed scheduling."}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MY PLAN could not update your device-reminder plan.");
    }
  };

  const removeUpcomingPersonalItems = async () => {
    try {
      await clearPersonalEnrollment.mutateAsync();
      setMessage("Upcoming local planning copies were removed from MY PLAN’s device-reminder service. Your browser workspace itself was not changed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MY PLAN could not remove the planning reminder copies.");
    }
  };

  const browserConnection: DeviceConnectionState = devicePermission === "checking" || (Boolean(browserSubscription) && currentDevice.isLoading) ? "checking" : currentDevice.data?.connected ? "connected" : "not-connected";
  const deliveryState = readiness.isLoading ? "checking" : readiness.isError ? "unavailable" : readiness.data?.ready ? "ready" : "setup-pending";
  const deviceStatus = deviceReminderAccessStatus({ permission: devicePermission, deliveryReady: Boolean(readiness.data?.ready), deliveryState, hasLocalSubscription: Boolean(browserSubscription), connection: browserConnection });
  const currentDeviceConnected = browserConnection === "connected";
  const accountDeviceEnabled = Boolean(preferences.data?.enabled && subscriptions.data?.length);
  const inAppEnabled = inAppReminderSettings.popupEnabled;
  const anyReminderEnabled = accountDeviceEnabled || inAppEnabled;
  return <section className="workspace-card reminder-workspace">
    <header className="reminder-heading"><div><p className="kicker"><BellRing size={15} /> Device reminders</p><h1>Helpful, even when closed.</h1><p>MY PLAN can send a quiet, branded system reminder to this device after you explicitly allow it. You stay in control of timing, quiet hours, and every connected browser.</p></div><div className={`reminder-seal ${anyReminderEnabled ? "is-enabled" : ""}`}><BellRing size={20} /><span>{anyReminderEnabled ? "Enabled" : "Optional"}</span></div></header>
    <section className="in-app-reminder-controls"><div><p className="kicker"><BellRing size={14} /> While MY PLAN is open</p><h2>Keep due reminders clear and calm.</h2><p>Choose whether this browser may show an in-app reminder popup for the timed plans you have already chosen to remind yourself about. Sound is always optional.</p></div><div className="in-app-reminder-options"><div className={`in-app-reminder-status ${inAppEnabled ? "is-enabled" : ""}`}><BellRing size={15} /><span><strong>{inAppEnabled ? "In-app reminders enabled" : "In-app reminders off"}</strong><small>{inAppEnabled ? (inAppReminderSettings.soundEnabled ? "Popup and gentle ring are enabled." : "Popup is enabled; gentle ring is off.") : "Enable the popup to receive reminders while MY PLAN is open."}</small></span></div><label><input type="checkbox" checked={inAppReminderSettings.popupEnabled} onChange={event => onUpdateInAppReminderSettings({ popupEnabled: event.target.checked, soundEnabled: event.target.checked ? inAppReminderSettings.soundEnabled : false })} /> Show due reminder popups</label><label><input type="checkbox" disabled={!inAppReminderSettings.popupEnabled} checked={inAppReminderSettings.soundEnabled} onChange={event => onUpdateInAppReminderSettings({ ...inAppReminderSettings, soundEnabled: event.target.checked })} /> Play a gentle ring</label><small>Each popup can be dismissed or snoozed for 5 minutes. This setting works only while MY PLAN is open in this browser.</small></div></section>
    {!isAuthenticated ? <section className="reminder-state"><ShieldCheck size={20} /><div><strong>Sign in to protect your device settings.</strong><span>Device subscriptions and off-app reminders are private to one MY PLAN account.</span></div><button className="accent" onClick={onSignIn}>Sign in <ExternalLink size={15} /></button></section> : null}
    {isAuthenticated ? <><section className={`reminder-permission is-${devicePermission} is-${browserConnection}`}><div className="permission-icon"><Smartphone size={21} /></div><div><p className="kicker">This browser</p><h2>{deviceStatus.heading}</h2><p>{deviceStatus.body}</p><div className="reminder-access-status" aria-label="Device reminder access status"><span><small>Browser permission</small><b>{deviceStatus.permissionLabel}</b></span><span><small>Device connection</small><b>{deviceStatus.connectionLabel}</b></span></div></div>{currentDeviceConnected ? <button className="reminder-disable" disabled={disableAll.isPending} onClick={() => void turnOffEverywhere()}><X size={15} /> Turn off everywhere</button> : devicePermission === "unsupported" || devicePermission === "denied" ? <span className="reminder-blocked">{devicePermission === "unsupported" ? "In-app reminders available" : "Permission blocked"}</span> : <button className="accent" disabled={!deviceStatus.canEnable || subscribe.isPending} onClick={() => void enableDevice()}><BellRing size={15} /> {subscribe.isPending ? "Connecting…" : deviceStatus.actionLabel || "Checking this browser…"}</button>}</section>
      <section className="reminder-preferences"><div className="list-progress-heading"><div><p className="kicker"><Clock3 size={14} /> Your delivery rules</p><h2>Gentle by default.</h2></div><span>Saved privately to your account</span></div><div className="reminder-control-grid"><label>Default timing<select value={leadMinutes} onChange={event => setLeadMinutes(Number(event.target.value))}>{leadOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>Used for new timed plans that you choose to remind yourself about.</small></label><label className="quiet-toggle"><span><input type="checkbox" checked={quietEnabled} onChange={event => setQuietEnabled(event.target.checked)} /> Quiet hours</span><small>Hold reminders until your chosen quiet period ends.</small></label>{quietEnabled ? <div className="quiet-time-row"><label>Start<input type="time" value={quietStart} onChange={event => setQuietStart(event.target.value)} /></label><label>End<input type="time" value={quietEnd} onChange={event => setQuietEnd(event.target.value)} /></label></div> : null}</div><button className="reminder-save" disabled={updatePreferences.isPending} onClick={savePreferences}><Check size={15} /> {updatePreferences.isPending ? "Saving…" : "Save reminder rules"}</button></section>
      <section className="reminder-plan-enrollment"><div><p className="kicker"><ShieldCheck size={14} /> Your planning data, by choice</p><h2>Bring upcoming items to device reminders.</h2><p>When you choose Sync upcoming items, MY PLAN securely saves only an item’s title, time, type, and destination for the next 120 days. It does not upload notes, courses, checklists, or other local workspace details. Sync again after editing an item; remove these copies whenever you choose.</p></div><div className="reminder-enrollment-summary"><strong>{personalReminderCandidates.length}</strong><span>upcoming item{personalReminderCandidates.length === 1 ? "" : "s"} available to sync</span>{enrollment.data?.activeCount ? <small>{enrollment.data.activeCount} currently approved for device reminders</small> : <small>No local planning items are stored for off-app delivery.</small>}</div><div className="reminder-enrollment-actions"><button className="accent" disabled={!currentDeviceConnected || syncPersonalEnrollment.isPending} onClick={() => void syncUpcomingPersonalItems()}><BellRing size={15} /> {syncPersonalEnrollment.isPending ? "Syncing…" : "Sync upcoming items"}</button>{enrollment.data?.activeCount ? <button disabled={clearPersonalEnrollment.isPending} onClick={() => void removeUpcomingPersonalItems()}>{clearPersonalEnrollment.isPending ? "Removing…" : "Remove planning copies"}</button> : null}</div>{!currentDeviceConnected ? <small className="reminder-enrollment-note">Connect this browser first. MY PLAN will not copy local planning items to the reminder service before that connection is confirmed.</small> : null}</section>
      <section className="reminder-devices"><div><p className="kicker"><Smartphone size={14} /> Connected browsers</p><h2>Your devices, your choice.</h2><p>Removing a browser stops MY PLAN from delivering to it. A browser-level permission can also be changed in its own settings.</p></div>{subscriptions.data?.length ? <ul>{subscriptions.data.map(device => <li key={device.id}><span><b>{device.userAgent?.includes("Mobile") ? "Mobile browser" : "Browser device"}</b><small>{device.status} · added {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(device.createdAt))}</small></span><button onClick={() => unsubscribe.mutate({ subscriptionId: device.id })}>Remove</button></li>)}</ul> : <div className="reminder-empty"><BellRing size={20} /><strong>No device is connected yet.</strong><p>Choose Enable device reminders above when delivery is ready.</p></div>}</section>
      {message ? <p className="reminder-message" role="status">{message}</p> : null}
      <aside className="reminder-note"><ShieldCheck size={17} /><span>MY PLAN asks only after you choose to enable reminders. It does not request permission on page load, and it never shares one user’s reminder content with another user.</span></aside>
    </> : null}
    <button className="account-link reminder-calendar-link" onClick={onOpenCalendar}>Use the in-app Notification Center <ExternalLink size={14} /></button>
  </section>;
}
