"use client";

import { useEffect, useState } from "react";
import { DOC_LANGS, type DocLang } from "@/lib/documents/i18n";

/** Share any Chrono PDF: phone share menu (pick WhatsApp) or download on a laptop. */
export function PdfShare({ path, label, shareText, mode = "share" }: { path: string; label: string; shareText: string; mode?: "share" | "print" }) {
  const [lang, setLang] = useState<DocLang>("en");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const url = `${path}${path.includes("?") ? "&" : "?"}lang=${lang}`;

  useEffect(() => {
    let alive = true;
    setFile(null);
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const name = (res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "chrono.pdf").replace(/\.pdf$/, `-${lang}.pdf`);
        const f = new File([await res.blob()], name, { type: "application/pdf" });
        if (alive) setFile(f);
      } catch {
        // Button stays disabled.
      }
    })();
    return () => {
      alive = false;
    };
  }, [url, lang]);

  /** Prints the PDF: straight to the print dialog on a computer, or opened full-screen on a phone to print from there. */
  const print = () => {
    if (!file) return;
    const href = URL.createObjectURL(file);
    const phone = window.matchMedia("(max-width: 759px)").matches || navigator.maxTouchPoints > 1;
    if (phone) {
      window.open(href, "_blank", "noopener");
    } else {
      const frame = document.createElement("iframe");
      frame.style.position = "fixed";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      frame.src = href;
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(href, "_blank", "noopener");
        }
      };
      document.body.appendChild(frame);
      setTimeout(() => frame.remove(), 60_000);
    }
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  };

  const share = async () => {
    if (!file) return;
    setMessage("");
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: file.name, text: shareText });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    const href = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = href;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 5000);
    setMessage("Downloaded. Attach the PDF in WhatsApp or email to send it.");
  };

  return (
    <div>
      <div className="choice-row" role="radiogroup" aria-label="Language" style={{ marginBottom: "0.75rem" }}>
        {DOC_LANGS.map((l) => (
          <label key={l.code} className="choice">
            <input type="radio" name={`lang-${path}`} value={l.code} checked={lang === l.code} onChange={() => setLang(l.code)} />
            {l.label}
          </label>
        ))}
      </div>
      <div className="grid-2">
        <button type="button" className="btn btn-icon" disabled={!file} onClick={mode === "print" ? print : share}>
          {mode === "print" && (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6.5 9V3.5h11V9" />
              <rect x="3" y="9" width="18" height="8" rx="2" />
              <path d="M6.5 14h11v6.5h-11z" />
              <path d="M17 11.5h.01" />
            </svg>
          )}
          {file ? label : "Preparing…"}
        </button>
        <a className="btn btn-quiet" href={url} target="_blank" rel="noopener noreferrer">
          Preview
        </a>
      </div>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
