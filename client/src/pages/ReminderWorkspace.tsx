import { BellRing, Check, Clock3, ExternalLink, ShieldCheck, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { createMyPlanPushSubscription, removeMyPlanPushSubscription, webPushSupport } from "@/lib/webPush";

type Props = { isAuthenticated: boolean; onSignIn: () => void; onOpenCalendar: () => void };
const leadOptions = [{ value: 0, label: "At start" }, { value: 10, label: "10 minutes before" }, { value: 30, label: "30 minutes before" }, { value: 60, label: "1 hour before" }, { value: 1440, label: "1 day before" }];

export default function ReminderWorkspace({ isAuthenticated, onSignIn, onOpenCalendar }: Props) {
  const readiness = trpc.push.readiness.useQuery();
  const preferences = trpc.push.preferences.useQuery(undefined, { enabled: isAuthenticated });
  const subscriptions = trpc.push.subscriptions.useQuery(undefined, { enabled: isAuthenticated });
  const updatePreferences = trpc.push.updatePreferences.useMutation({ onSuccess: () => void preferences.refetch() });
  const subscribe = trpc.push.subscribe.useMutation({ onSuccess: () => { void preferences.refetch(); void subscriptions.refetch(); } });
  const disableAll = trpc.push.disableAll.useMutation({ onSuccess: () => { void preferences.refetch(); void subscriptions.refetch(); } });
  const unsubscribe = trpc.push.unsubscribe.useMutation({ onSuccess: () => void subscriptions.refetch() });
  const [message, setMessage] = useState("");
  const [leadMinutes, setLeadMinutes] = useState(10);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:30");
  const [quietEnd, setQuietEnd] = useState("07:00");

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
    if (!webPushSupport()) return setMessage("This browser does not support MY PLAN device reminders. You can still use the in-app Notification Center.");
    if (!readiness.data?.ready || !readiness.data.publicKey) return setMessage(readiness.data?.message || "Device reminders are being prepared.");
    try {
      const device = await createMyPlanPushSubscription(readiness.data.publicKey);
      await subscribe.mutateAsync({ ...device, userAgent: navigator.userAgent.slice(0, 512) });
      setMessage("Device reminders are on for this browser. MY PLAN will use your timing and quiet-hours choices.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MY PLAN could not enable device reminders.");
    }
  };

  const turnOffEverywhere = async () => {
    await removeMyPlanPushSubscription();
    await disableAll.mutateAsync();
    setMessage("MY PLAN device reminders are off and saved device subscriptions were revoked.");
  };

  const enabled = Boolean(preferences.data?.enabled && subscriptions.data?.length);
  return <section className="workspace-card reminder-workspace">
    <header className="reminder-heading"><div><p className="kicker"><BellRing size={15} /> Device reminders</p><h1>Helpful, even when closed.</h1><p>MY PLAN can send a quiet, branded system reminder to this device after you explicitly allow it. You stay in control of timing, quiet hours, and every connected browser.</p></div><div className={`reminder-seal ${enabled ? "is-enabled" : ""}`}><BellRing size={20} /><span>{enabled ? "On" : "Optional"}</span></div></header>
    {!isAuthenticated ? <section className="reminder-state"><ShieldCheck size={20} /><div><strong>Sign in to protect your device settings.</strong><span>Device subscriptions and off-app reminders are private to one MY PLAN account.</span></div><button className="accent" onClick={onSignIn}>Sign in <ExternalLink size={15} /></button></section> : null}
    {isAuthenticated ? <><section className="reminder-permission"><div className="permission-icon"><Smartphone size={21} /></div><div><p className="kicker">This device</p><h2>{enabled ? "MY PLAN can remind you here." : readiness.data?.ready ? "Enable the reminders you asked for." : "Device delivery is being prepared."}</h2><p>{enabled ? "Notifications appear outside MY PLAN and open the relevant private planning view when selected." : readiness.data?.message || "Your browser will only be asked after you choose Enable device reminders."}</p></div>{enabled ? <button className="reminder-disable" disabled={disableAll.isPending} onClick={() => void turnOffEverywhere()}><X size={15} /> Turn off everywhere</button> : <button className="accent" disabled={!readiness.data?.ready || subscribe.isPending} onClick={() => void enableDevice()}><BellRing size={15} /> {subscribe.isPending ? "Enabling…" : "Enable device reminders"}</button>}</section>
      <section className="reminder-preferences"><div className="list-progress-heading"><div><p className="kicker"><Clock3 size={14} /> Your delivery rules</p><h2>Gentle by default.</h2></div><span>Saved privately to your account</span></div><div className="reminder-control-grid"><label>Default timing<select value={leadMinutes} onChange={event => setLeadMinutes(Number(event.target.value))}>{leadOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>Used for new timed plans that you choose to remind yourself about.</small></label><label className="quiet-toggle"><span><input type="checkbox" checked={quietEnabled} onChange={event => setQuietEnabled(event.target.checked)} /> Quiet hours</span><small>Hold reminders until your chosen quiet period ends.</small></label>{quietEnabled ? <div className="quiet-time-row"><label>Start<input type="time" value={quietStart} onChange={event => setQuietStart(event.target.value)} /></label><label>End<input type="time" value={quietEnd} onChange={event => setQuietEnd(event.target.value)} /></label></div> : null}</div><button className="reminder-save" disabled={updatePreferences.isPending} onClick={savePreferences}><Check size={15} /> {updatePreferences.isPending ? "Saving…" : "Save reminder rules"}</button></section>
      <section className="reminder-devices"><div><p className="kicker"><Smartphone size={14} /> Connected browsers</p><h2>Your devices, your choice.</h2><p>Removing a browser stops MY PLAN from delivering to it. A browser-level permission can also be changed in its own settings.</p></div>{subscriptions.data?.length ? <ul>{subscriptions.data.map(device => <li key={device.id}><span><b>{device.userAgent?.includes("Mobile") ? "Mobile browser" : "Browser device"}</b><small>{device.status} · added {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(device.createdAt))}</small></span><button onClick={() => unsubscribe.mutate({ subscriptionId: device.id })}>Remove</button></li>)}</ul> : <div className="reminder-empty"><BellRing size={20} /><strong>No device is connected yet.</strong><p>Choose Enable device reminders above when delivery is ready.</p></div>}</section>
      {message ? <p className="reminder-message" role="status">{message}</p> : null}
      <aside className="reminder-note"><ShieldCheck size={17} /><span>MY PLAN asks only after you choose to enable reminders. It does not request permission on page load, and it never shares one user’s reminder content with another user.</span></aside>
    </> : null}
    <button className="account-link reminder-calendar-link" onClick={onOpenCalendar}>Use the in-app Notification Center <ExternalLink size={14} /></button>
  </section>;
}
