"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { assistantStrings } from "@/lib/ui-strings";

const Widget = dynamic(() => import("./AssistantWidget"), { ssr: false });
export default function AssistantLauncher() {
  const [activated, setActivated] = useState(false);
  const { lang } = useLang();
  const title = assistantStrings(lang).title;
  if (activated) return <Widget initiallyOpen />;
  return (
    <div
      className="fixed bottom-4 right-4 z-50 print-hidden"
      data-testid="assistant-root"
    >
      <button
        type="button"
        data-testid="assistant-open-btn"
        aria-label={title}
        onClick={() => setActivated(true)}
        className="inline-flex items-center gap-2 rounded-full border-2 border-white bg-brand-800 p-3.5 text-sm font-bold text-white shadow-xl sm:px-5"
      >
        <Sparkles size={22} />
        <span className="hidden sm:inline">{title}</span>
      </button>
    </div>
  );
}
