"use client";

import { useEffect, useState } from "react";
import { DOC_LANGS, type DocLang } from "@/lib/documents/i18n";
import type { DocPreview } from "@/lib/documents/preview";

type Kind = "quote" | "invoice";

/**
 * Share a quote or invoice as a PDF. On phones this opens the share menu with the
 * PDF attached, so the owner can pick WhatsApp. On laptops it downloads the PDF.
 * The PDF is prepared in advance so the share happens straight from the tap.
 */
export function DocumentShare({ orderId, kinds, businessName, previews }: { orderId: string; kinds: Kind[]; businessName: string; previews?: Record<DocLang, DocPreview> }) {
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
            <label key={l.code} className="choice" data-tour={`lang-${l.code}`}>
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
      {previews && <DocPaper preview={previews[lang]} />}
      {message && <p className="hint">{message}</p>}
    </div>
  );
}

/** A small on-screen copy of the PDF, so owners (and viewers) can see exactly what the customer gets. */
export function DocPaper({ preview }: { preview: DocPreview }) {
  return (
    <div className="doc-paper" data-tour="doc-preview" aria-label={`Preview: ${preview.title}`}>
      <div className="doc-paper-head">
        <span>
          <strong>{preview.businessName}</strong>
          {preview.businessType && <span className="doc-paper-sub">{preview.businessType}</span>}
        </span>
        <span className="doc-paper-title">{preview.title}</span>
      </div>
      <div className="doc-paper-body">
        {preview.details.map((d) => (
          <p key={d.label} className="doc-paper-detail">
            <span>{d.label}</span>
            <b>{d.value}</b>
          </p>
        ))}
        <div className="doc-paper-rows">
          {preview.rows.map((r) => (
            <div key={r.label} className="doc-paper-row" data-strong={!!r.strong}>
              <span>
                {r.label}
                {r.detail && <span className="doc-paper-sub">{r.detail}</span>}
              </span>
              <span className="num">{r.amount}</span>
            </div>
          ))}
        </div>
        <p className="doc-paper-note">{preview.note}</p>
        <p className="doc-paper-sub">{preview.footer}</p>
      </div>
    </div>
  );
}
