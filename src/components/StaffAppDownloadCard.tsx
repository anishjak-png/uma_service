"use client";

const APK_HREF = "/staff/uma-traders.apk";

export function StaffAppDownloadCard() {
  return (
    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-sm font-semibold text-emerald-900">Staff Android app</p>
      <p className="mt-1 text-xs leading-snug text-emerald-800">
        Opens the live Uma Service site. After install, app updates appear
        automatically — no new APK for normal changes.
      </p>
      <a
        href={APK_HREF}
        download="uma-traders.apk"
        className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Download APK
      </a>
    </div>
  );
}
