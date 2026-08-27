import { ArrowRight, BellRing, CirclePlus, LogIn, MessageCircleMore, RefreshCw, Settings2, ShieldCheck, Upload } from "lucide-react";

type ToolSection = "accounts" | "settings" | "sync" | "import" | "assistant" | "reminders";

export default function WorkspaceTools({ onOpen, isAuthenticated, onSignIn }: { onOpen: (section: ToolSection) => void; isAuthenticated: boolean; onSignIn: () => void }) {
  return <section className="workspace-card tools-workspace">
    <header className="tools-heading">
      <div><p className="kicker"><Upload size={15} /> Workspace tools</p><h1>Useful when you need them.</h1><p>Planning stays in Calendar and To-do. These optional utilities stay calm and out of the way.</p></div>
    </header>
    <div className="tools-primary" aria-label="Primary workspace tools">
      <button className="tool-card" onClick={() => onOpen("settings")}><Settings2 size={20} /><span><strong>Settings & reminders</strong><small>Manage reminders, notifications, connected services, and planning preferences.</small></span><ArrowRight size={16} /></button>
      <button className="tool-card is-primary tool-card-account" onClick={() => isAuthenticated ? onOpen("accounts") : onSignIn()}><CirclePlus size={20} /><span><strong>{isAuthenticated ? "Connected calendars" : "Sign in to MY PLAN"}</strong><small>{isAuthenticated ? "Manage your private account, connect Google, and choose the calendars that belong to you." : "Create your private MY PLAN account to sync calendars, import schedules, and use connected tools."}</small></span>{isAuthenticated ? <ArrowRight size={16} /> : <LogIn size={16} />}</button>
      <button className="tool-card is-primary" onClick={() => onOpen("assistant")}><MessageCircleMore size={20} /><span><strong>MY PLAN Assistant</strong><small>Ask in plain language and review the task, event, focus block, or reminder draft before saving.</small></span><ArrowRight size={16} /></button>
      <button className="tool-card" onClick={() => onOpen("import")}><Upload size={20} /><span><strong>Import schedule</strong><small>Turn a PDF, image, document, spreadsheet, CSV, or ICS file into private review suggestions.</small></span><ArrowRight size={16} /></button>
    </div>
    <section className="tools-secondary" aria-label="More workspace utilities">
      <p className="tools-secondary-label">Calendar setup</p>
      <div>
      <button className="tool-card" onClick={() => onOpen("reminders")}><BellRing size={18} /><span><strong>Reminders</strong><small>Choose timing and enable private MY PLAN notifications on your devices.</small></span><ArrowRight size={15} /></button>
      <button className="tool-card" onClick={() => onOpen("sync")}><RefreshCw size={18} /><span><strong>Calendar sync</strong><small>Review connection health and reminder delivery.</small></span><ArrowRight size={15} /></button>
      </div>
    </section>
    <aside className="tools-note"><ShieldCheck size={17} /><span>Connections and imports stay private to the MY PLAN account that owns them.</span></aside>
  </section>;
}
