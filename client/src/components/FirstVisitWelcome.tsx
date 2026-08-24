import { ArrowRight, BookOpenCheck, LogIn, Sparkles, UserRound } from "lucide-react";
import type { FirstVisitChoice, FirstVisitStage } from "@/lib/firstVisitFlow";

export default function FirstVisitWelcome({ stage, choice, onChoose, onTutorialChoice }: {
  stage: FirstVisitStage;
  choice: FirstVisitChoice | null;
  onChoose: (choice: FirstVisitChoice) => void;
  onTutorialChoice: (takeTour: boolean) => void;
}) {
  if (stage === "hidden") return null;
  const isSignIn = choice === "sign-in";
  return <div className="first-visit-backdrop" role="presentation">
    <section className="first-visit-dialog" role="dialog" aria-modal="true" aria-labelledby="first-visit-title">
      <div className="first-visit-mark" aria-hidden="true"><BookOpenCheck size={21} /></div>
      {stage === "choice" ? <>
        <p className="kicker">Your clear plan starts here</p>
        <h1 id="first-visit-title">Welcome to <em>MY PLAN.</em></h1>
        <p className="first-visit-lede">Choose how you want to begin. You can plan locally now, or sign in when you want private connected tools.</p>
        <div className="first-visit-options">
          <button className="first-visit-option is-primary" onClick={() => onChoose("sign-in")}><span className="first-visit-option-icon"><LogIn size={18} /></span><span><b>Sign in to MY PLAN</b><small>Sync, imports, and private connections</small></span><ArrowRight size={17} /></button>
          <button className="first-visit-option" onClick={() => onChoose("guest")}><span className="first-visit-option-icon"><UserRound size={18} /></span><span><b>Continue as a guest</b><small>Plan locally in this browser</small></span><ArrowRight size={17} /></button>
        </div>
        <p className="first-visit-footnote">You can change this later from Workspace tools.</p>
      </> : <>
        <p className="kicker">{isSignIn ? "One last choice before sign-in" : "One last choice before planning"}</p>
        <h1 id="first-visit-title">Want a quick tour?</h1>
        <p className="first-visit-lede">It takes about a minute and shows calendar actions, tasks, and the workspace tools. You can skip it and revisit it later.</p>
        <div className="first-visit-options first-visit-tour-options">
          <button className="first-visit-option is-primary" onClick={() => onTutorialChoice(true)}><span className="first-visit-option-icon"><Sparkles size={18} /></span><span><b>Yes, show me around</b><small>Start the guided MY PLAN tour</small></span><ArrowRight size={17} /></button>
          <button className="first-visit-option" onClick={() => onTutorialChoice(false)}><span className="first-visit-option-icon"><BookOpenCheck size={18} /></span><span><b>No thanks, I’ll explore</b><small>{isSignIn ? "Continue to secure sign-in" : "Open my calendar"}</small></span><ArrowRight size={17} /></button>
        </div>
      </>}
    </section>
  </div>;
}
