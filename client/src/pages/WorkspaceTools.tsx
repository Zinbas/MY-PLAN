import { ArrowRight, CirclePlus, RefreshCw, ShieldCheck, Sparkles, Upload } from "lucide-react";

type ToolSection = "accounts" | "sync" | "import" | "spark";

export default function WorkspaceTools({ onOpen }: { onOpen: (section: ToolSection) => void }) {
  return <section className="workspace-card tools-workspace">
    <header className="tools-heading">
      <div><p className="kicker"><Upload size={15} /> Workspace tools</p><h1>Useful when you need them.</h1><p>Planning stays in Calendar and To-do. These optional utilities stay calm and out of the way.</p></div>
    </header>
    <div className="tools-primary" aria-label="Primary workspace tools">
      <button className="tool-card is-primary" onClick={() => onOpen("import")}><Upload size={20} /><span><strong>Import a schedule</strong><small>Turn a PDF, image, document, spreadsheet, CSV, or ICS file into private review suggestions.</small></span><ArrowRight size={16} /></button>
      <button className="tool-card" onClick={() => onOpen("accounts")}><CirclePlus size={20} /><span><strong>Account & calendar</strong><small>Sign in, connect Google when ready, and choose the calendars that belong to you.</small></span><ArrowRight size={16} /></button>
    </div>
    <details className="tools-more"><summary>More workspace utilities <span>Sync and Gemini Spark</span></summary><div>
      <button className="tool-card" onClick={() => onOpen("sync")}><RefreshCw size={18} /><span><strong>Sync center</strong><small>Review connection health and reminder delivery.</small></span><ArrowRight size={15} /></button>
      <button className="tool-card" onClick={() => onOpen("spark")}><Sparkles size={18} /><span><strong>Gemini Spark</strong><small>Review the separate, secure connection setup.</small></span><ArrowRight size={15} /></button>
    </div></details>
    <aside className="tools-note"><ShieldCheck size={17} /><span>Connections and imports stay private to the MY PLAN account that owns them.</span></aside>
  </section>;
}
