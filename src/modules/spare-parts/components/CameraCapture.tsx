"use client";

import { useEffect, useRef, useState } from "react";
import { resizeImageFile } from "../lib/format";
import { btnPrimary, btnSecondary } from "./ui";

type Props = {
  onConfirm: (file: File) => void | Promise<void>;
  busy?: boolean;
  confirmLabel?: string;
  autoSubmit?: boolean;
};

export function CameraCapture({
  onConfirm,
  busy = false,
  confirmLabel = "Confirm",
  autoSubmit = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [live, setLive] = useState(false);
  const [canLive, setCanLive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCanLive(window.isSecureContext && !!navigator.mediaDevices?.getUserMedia);
    return () => stopLive();
  }, []);

  function stopLive() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  }

  async function openLiveCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError("Camera preview needs HTTPS. Use Take photo instead.");
    }
  }

  async function captureLive() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 768;
    canvas.height = video.videoHeight || 768;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const raw = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error("Capture failed"))),
        "image/jpeg",
        0.92,
      );
    });
    stopLive();
    await useBlob(raw);
  }

  async function useBlob(file: Blob) {
    try {
      const resized = await resizeImageFile(file);
      setError("");
      if (autoSubmit) {
        await onConfirm(new File([resized], "capture.jpg", { type: "image/jpeg" }));
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setBlob(resized);
      setPreviewUrl(URL.createObjectURL(resized));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this photo");
    }
  }

  async function confirm() {
    if (!blob) return;
    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    await onConfirm(file);
  }

  return (
    <div className="space-y-3">
      {live ? (
        <div className="overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
          <div className="flex gap-2 p-3">
            <button type="button" className={btnSecondary} onClick={stopLive}>
              Cancel
            </button>
            <button type="button" className={btnPrimary} onClick={() => void captureLive()}>
              Capture
            </button>
          </div>
        </div>
      ) : previewUrl ? (
        <div className="space-y-3">
          <img src={previewUrl} alt="Captured spare part" className="w-full rounded-lg object-cover" />
          <div className="flex gap-2">
            <label className={`${btnSecondary} flex-1`}>
              Retake
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void useBlob(file);
                }}
              />
            </label>
            <button type="button" className={`${btnPrimary} flex-1`} onClick={() => void confirm()} disabled={busy}>
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">Show the spare part</p>
          <p className="mt-1 text-xs text-slate-500">Use the phone camera. Fill the frame if you can.</p>
          <div className="mt-4 flex flex-col gap-2">
            <label className={btnPrimary}>
              Take photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void useBlob(file);
                }}
              />
            </label>
            <label className={btnSecondary}>
              Choose from gallery
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void useBlob(file);
                }}
              />
            </label>
            {canLive ? (
              <button type="button" className={btnSecondary} onClick={() => void openLiveCamera()}>
                Live preview
              </button>
            ) : null}
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
