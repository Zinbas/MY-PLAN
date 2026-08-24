import { ArrowRight, LogIn, UserRound } from "lucide-react";
import { accountAccessLabel } from "@/lib/accountAccessUx";

export default function AccountQuickAccess({ isAuthenticated, name, onSignIn, onOpenAccount }: {
  isAuthenticated: boolean;
  name?: string | null;
  onSignIn: () => void;
  onOpenAccount: () => void;
}) {
  const signedOut = !isAuthenticated;
  return <button className={`account-quick-access ${signedOut ? "is-signed-out" : ""}`} onClick={signedOut ? onSignIn : onOpenAccount} aria-label={signedOut ? "Sign in to MY PLAN" : "Open your MY PLAN account"}>
    <span className="account-quick-icon">{signedOut ? <LogIn size={15} /> : <UserRound size={15} />}</span>
    <span><b>{accountAccessLabel(isAuthenticated, name)}</b><small>{signedOut ? "Sync, imports & private tools" : "Account & connections"}</small></span>
    <ArrowRight size={14} aria-hidden="true" />
  </button>;
}
