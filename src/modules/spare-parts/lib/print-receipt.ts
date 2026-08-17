"use client";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Open the system print dialog with Uma Service 80mm thermal layout. */
export function printThermal80mm(receiptText: string, title: string): boolean {
  const html = `<!DOCTYPE html>
<html><head><title>Receipt ${escapeHtml(title)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: "Courier New", Courier, monospace; font-size: 12px; padding: 8px; max-width: 80mm; margin: 0 auto; }
  pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
</style></head>
<body><pre>${escapeHtml(receiptText)}</pre></body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    document.body.removeChild(iframe);
    return false;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  window.setTimeout(() => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }
  }, 300);

  return true;
}
