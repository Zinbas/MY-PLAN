import { Copy, Sparkles } from "lucide-react";

type SparkWorkspaceProps = {
  isAuthenticated: boolean;
  accessToken: string | null;
  isPreparing: boolean;
  onCopyUrl: () => void;
  onCopyToken: () => void;
  onGenerateToken: () => void;
};

export default function SparkWorkspace({ isAuthenticated, accessToken, isPreparing, onCopyUrl, onCopyToken, onGenerateToken }: SparkWorkspaceProps) {
  return <section className="workspace-card spark-card"><p className="kicker"><Sparkles size={15} /> Agent-ready calendar</p><h1>Gemini Spark</h1><p>Connect Spark to create, list, update, and remove events in only your private MY PLAN workspace. Spark must confirm dates and times before changing your plan.</p><code>/api/mcp</code><button onClick={onCopyUrl}><Copy size={15} /> Copy MCP URL</button>{!isAuthenticated ? <p className="account-footnote">Sign in to generate a private connection credential.</p> : <section className="spark-credential"><strong>Private Spark credential</strong><p>Generate this only when you are ready to connect Spark. Generating another one immediately revokes the previous credential.</p>{accessToken ? <><code>{accessToken}</code><button onClick={onCopyToken}><Copy size={15} /> Copy credential</button></> : <button className="accent" disabled={isPreparing} onClick={onGenerateToken}>{isPreparing ? "Preparing credential…" : "Generate connection credential"}</button>}</section>}</section>;
}
