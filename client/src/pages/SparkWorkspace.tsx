import { Copy, Sparkles } from "lucide-react";
import "./spark.css";

type SparkWorkspaceProps = {
  isAuthenticated: boolean;
  accessToken: string | null;
  isPreparing: boolean;
  onCopyUrl: () => void;
  onCopyToken: () => void;
  onGenerateToken: () => void;
};

export default function SparkWorkspace({ isAuthenticated, accessToken, isPreparing, onCopyUrl, onCopyToken, onGenerateToken }: SparkWorkspaceProps) {
  return <section className="workspace-card spark-card"><p className="kicker"><Sparkles size={15} /> Agent-ready calendar</p><h1>Gemini Spark connection</h1><p>MY PLAN keeps agent access private and scoped to the signed-in workspace. Gemini Spark requires a standards-based OAuth connection before it can use a custom MCP app.</p><aside className="spark-oauth-note"><strong>Spark OAuth setup is in progress</strong><p>The current private MY PLAN credential is <b>not supported by Gemini Spark</b>. Do not paste it into Gemini. It remains available only for compatible private MCP clients while OAuth support is prepared.</p></aside><code>/api/mcp</code><button onClick={onCopyUrl}><Copy size={15} /> Copy private MCP URL</button>{!isAuthenticated ? <p className="account-footnote">Sign in to generate a private connection credential for compatible MCP clients.</p> : <section className="spark-credential"><strong>Private MCP credential</strong><p>Generate this only for a compatible private MCP client. Generating another one immediately revokes the previous credential.</p>{accessToken ? <><code>{accessToken}</code><button onClick={onCopyToken}><Copy size={15} /> Copy private credential</button></> : <button className="accent" disabled={isPreparing} onClick={onGenerateToken}>{isPreparing ? "Preparing credential…" : "Generate private credential"}</button>}</section>}</section>;
}
