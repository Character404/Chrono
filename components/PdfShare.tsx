"use client";

import { useEffect, useState } from "react";
import { DOC_LANGS, type DocLang } from "@/lib/documents/i18n";

/** Share any Chrono PDF: phone share menu (pick WhatsApp) or download on a laptop. */
export function PdfShare({ path, label, shareText }: { path: string; label: string; shareText: string }) {
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
        <button type="button" className="btn" disabled={!file} onClick={share}>
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
