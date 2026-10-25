"use client";

import { useEffect, useState } from "react";
import { DOC_LANGS, type DocLang } from "@/lib/documents/i18n";

type Kind = "quote" | "invoice";

/**
 * Share a quote or invoice as a PDF. On phones this opens the share menu with the
 * PDF attached, so the owner can pick WhatsApp. On laptops it downloads the PDF.
 * The PDF is prepared in advance so the share happens straight from the tap.
 */
export function DocumentShare({ orderId, kinds, businessName }: { orderId: string; kinds: Kind[]; businessName: string }) {
  const [lang, setLang] = useState<DocLang>("en");
  const [files, setFiles] = useState<Partial<Record<Kind, File>>>({});
  const [message, setMessage] = useState("");

  const kindsKey = kinds.join(",");

  useEffect(() => {
    let alive = true;
    setFiles({});
    (async () => {
      const ready: Partial<Record<Kind, File>> = {};
      for (const kind of kindsKey.split(",") as Kind[]) {
        try {
          const res = await fetch(`/api/documents/${orderId}?type=${kind}&lang=${lang}`);
          if (!res.ok) continue;
          const name = (res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `${kind}.pdf`).replace(/\.pdf$/, `-${lang}.pdf`);
          ready[kind] = new File([await res.blob()], name, { type: "application/pdf" });
        } catch {
          // Leave this one unavailable; the button stays disabled.
        }
      }
      if (alive) setFiles(ready);
    })();
    return () => {
      alive = false;
    };
  }, [orderId, lang, kindsKey]);

  const share = async (kind: Kind) => {
    const file = files[kind];
    if (!file) return;
    setMessage("");
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: file.name, text: `${kind === "quote" ? "Quote" : "Invoice"} from ${businessName}` });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setMessage("Downloaded. Attach the PDF in WhatsApp to send it.");
  };

  return (
    <div className="doc-share">
      <div className="field" style={{ marginBottom: "0.75rem" }}>
        <label htmlFor="doc-lang">Language for the customer</label>
        <div className="choice-row" id="doc-lang" role="radiogroup">
          {DOC_LANGS.map((l) => (
            <label key={l.code} className="choice">
              <input type="radio" name="doc-lang" value={l.code} checked={lang === l.code} onChange={() => setLang(l.code)} />
              {l.label}
            </label>
          ))}
        </div>
      </div>
      <div className="stack">
        {kinds.map((kind) => (
          <div key={kind} className="grid-2">
            <button type="button" className="btn" disabled={!files[kind]} onClick={() => share(kind)}>
              {files[kind] ? `Share ${kind} (PDF)` : "Preparing…"}
            </button>
            <a className="btn btn-quiet" href={`/api/documents/${orderId}?type=${kind}&lang=${lang}`} target="_blank" rel="noopener noreferrer">
              Preview
            </a>
          </div>
        ))}
      </div>
      {message && <p className="hint">{message}</p>}
      {lang === "nso" && <p className="hint">Sepedi documents are a first draft, checked by our team.</p>}
    </div>
  );
}
