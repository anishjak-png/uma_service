"use client";

import { formatDateTime } from "@/lib/jobs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Conversation = {
  id: string;
  customerMobile: string;
  mobileDisplay: string;
  customerName: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  latestJob: { id: string; jobNumber: string; status: string } | null;
};

type Message = {
  id: string;
  source: "chat" | "automated";
  direction: "inbound" | "outbound";
  messageType: string;
  body: string | null;
  mediaId?: string | null;
  wamid?: string | null;
  reactedToWamid?: string | null;
  status: string;
  createdAt: string;
  automatedLabel?: string;
  jobCard?: { id: string; jobNumber: string; status?: string } | null;
};

type ThreadData = {
  conversation: Conversation & { unreadCount: number };
  messages: Message[];
};

function ReactionStrip({ emojis }: { emojis: string[] }) {
  if (emojis.length === 0) return null;
  return (
    <div className="-mt-2 flex px-1">
      <span className="inline-flex items-center rounded-full border border-[#E9EDEF] bg-white px-2 py-0.5 text-base shadow-sm">
        {emojis.join("")}
      </span>
    </div>
  );
}

function partitionThreadMessages(messages: Message[]) {
  const wamids = new Set(
    messages.map((m) => m.wamid).filter((id): id is string => Boolean(id))
  );
  const reactionsByWamid = new Map<string, string[]>();
  const orphanReactions: Message[] = [];
  const visibleMessages: Message[] = [];

  for (const m of messages) {
    if (m.messageType === "reaction" && m.body) {
      if (m.reactedToWamid && wamids.has(m.reactedToWamid)) {
        const list = reactionsByWamid.get(m.reactedToWamid) ?? [];
        list.push(m.body);
        reactionsByWamid.set(m.reactedToWamid, list);
      } else {
        orphanReactions.push(m);
      }
      continue;
    }
    if (m.messageType === "unsupported" && m.body === "[reaction message]") {
      orphanReactions.push({ ...m, body: "Reaction" });
      continue;
    }
    visibleMessages.push(m);
  }

  return { visibleMessages, reactionsByWamid, orphanReactions };
}

function chatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function listTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) return chatTime(iso);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function avatarInitials(name: string | null, mobile: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  return mobile.slice(-2);
}

function ChatImage({
  mediaId,
  alt,
  onOpen,
}: {
  mediaId: string;
  alt: string;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex min-h-[120px] min-w-[180px] items-center justify-center rounded-md bg-black/5 px-4 py-6 text-center text-xs text-[#667781]">
        Photo unavailable
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block overflow-hidden rounded-md text-left"
      aria-label="View photo"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/admin/whatsapp/media/${mediaId}`}
        alt={alt}
        className="max-h-72 max-w-full cursor-pointer object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </button>
  );
}

function ImageLightbox({
  mediaId,
  alt,
  onClose,
}: {
  mediaId: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <div className="flex shrink-0 items-center gap-2 bg-black/50 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-full px-3 py-2 text-white hover:bg-white/10"
          aria-label="Close photo"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          <span className="text-sm font-medium md:hidden">Back</span>
        </button>
        <span className="min-w-0 flex-1 truncate text-sm text-white/80">{alt}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-white hover:bg-white/10"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex min-h-0 flex-1 items-center justify-center p-4"
        aria-label="Close photo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/admin/whatsapp/media/${mediaId}`}
          alt={alt}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </button>
    </div>
  );
}

export function WhatsAppInboxTab({
  onUnreadChange,
}: {
  onUnreadChange?: (count: number) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [reply, setReply] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ mediaId: string; alt: string } | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/admin/whatsapp/conversations");
    if (!res.ok) return;
    const data = await res.json();
    setConversations(data.conversations ?? []);
    onUnreadChange?.(data.totalUnread ?? 0);
    setLoadingList(false);
  }, [onUnreadChange]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      setLoadingThread(true);
      setError("");
      const res = await fetch(
        `/api/admin/whatsapp/conversations/${conversationId}/messages`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.error === "string"
            ? data.error
            : "Failed to load messages"
        );
        setLoadingThread(false);
        return;
      }
      const data = await res.json();
      setThread(data);
      setLoadingThread(false);

      await fetch(`/api/admin/whatsapp/conversations/${conversationId}/read`, {
        method: "PATCH",
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
      loadConversations();
    },
    [loadConversations]
  );

  useEffect(() => {
    void loadConversations();
    const interval = setInterval(() => void loadConversations(), 30000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      return;
    }
    void loadThread(selectedId);
    const interval = setInterval(() => void loadThread(selectedId), 30000);
    return () => clearInterval(interval);
  }, [selectedId, loadThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages]);

  useEffect(() => {
    if (!pendingImage) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingImage);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingImage]);

  function clearPendingImage() {
    setPendingImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller");
      return;
    }
    setError("");
    setPendingImage(file);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;

    if (pendingImage) {
      setSending(true);
      setError("");
      const form = new FormData();
      form.append("file", pendingImage);
      if (reply.trim()) {
        form.append("caption", reply.trim());
      }

      const res = await fetch(
        `/api/admin/whatsapp/conversations/${selectedId}/messages`,
        { method: "POST", body: form }
      );
      const data = await res.json().catch(() => ({}));
      setSending(false);

      if (!res.ok) {
        setError(data.error ?? "Failed to send image");
        return;
      }

      setReply("");
      clearPendingImage();
      await loadThread(selectedId);
      await loadConversations();
      return;
    }

    if (!reply.trim()) return;

    setSending(true);
    setError("");
    const res = await fetch(
      `/api/admin/whatsapp/conversations/${selectedId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      }
    );
    const data = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to send reply");
      return;
    }

    setReply("");
    await loadThread(selectedId);
    await loadConversations();
  }

  const active = thread?.conversation;
  const displayName = active?.customerName ?? active?.mobileDisplay ?? "";
  const showChatOnMobile = Boolean(selectedId);

  const threadParts = useMemo(
    () => partitionThreadMessages(thread?.messages ?? []),
    [thread?.messages]
  );

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[420px] overflow-hidden rounded-lg border border-slate-200 bg-[#D1D7DB] shadow-sm md:h-[calc(100dvh-7rem)]">
      {/* Chat list — WhatsApp left panel */}
      <div
        className={`flex w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-[340px] lg:w-[380px] ${
          showChatOnMobile ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="bg-[#F0F2F5] px-4 py-3">
          <h2 className="text-base font-semibold text-[#111B21]">Chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              No chats yet. Customer replies appear here after webhook setup.
            </p>
          ) : (
            <ul>
              {conversations.map((c) => {
                const name = c.customerName ?? c.mobileDisplay;
                const selected = selectedId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#F5F6F6] ${
                        selected ? "bg-[#F0F2F5]" : ""
                      }`}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#DFE5E7] text-sm font-medium text-[#54656F]">
                        {avatarInitials(c.customerName, c.mobileDisplay)}
                      </div>
                      <div className="min-w-0 flex-1 border-b border-[#E9EDEF] pb-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[15px] font-normal text-[#111B21]">
                            {name}
                          </p>
                          <span className="shrink-0 text-[11px] text-[#667781]">
                            {listTime(c.lastMessageAt)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="line-clamp-1 text-[13px] text-[#667781]">
                            {c.lastMessagePreview ?? c.mobileDisplay}
                          </p>
                          {c.unreadCount > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-medium text-white">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Chat thread — WhatsApp right panel */}
      <div
        className={`min-w-0 flex-1 flex-col ${
          showChatOnMobile ? "flex" : "hidden md:flex"
        }`}
      >
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-[#F0F2F5] px-6 text-center">
            <div className="mb-4 rounded-full bg-[#DFE5E7] p-6">
              <svg
                viewBox="0 0 24 24"
                className="h-16 w-16 text-[#54656F]"
                fill="currentColor"
                aria-hidden
              >
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l4.93-1.29A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.21-.45-4.55-1.24l-.33-.2-2.92.76.78-2.85-.21-.33A7.96 7.96 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
              </svg>
            </div>
            <p className="text-lg font-light text-[#41525D]">UMA WhatsApp Inbox</p>
            <p className="mt-2 max-w-sm text-sm text-[#667781]">
              Select a chat to view automated job messages and customer replies.
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 bg-[#008069] px-2 py-2 text-white shadow-sm md:px-4">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-full p-2 hover:bg-white/10 md:hidden"
                aria-label="Back to chats"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
              </button>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-medium">
                {avatarInitials(active?.customerName ?? null, active?.mobileDisplay ?? "")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">{displayName}</p>
                <p className="truncate text-xs text-white/80">
                  {active?.mobileDisplay}
                  {active?.latestJob
                    ? ` · ${active.latestJob.jobNumber}`
                    : ""}
                </p>
              </div>
              {active?.latestJob && (
                <Link
                  href={`/jobs/${active.latestJob.id}`}
                  className="shrink-0 rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25"
                >
                  Open job
                </Link>
              )}
            </div>

            {/* Messages area — WhatsApp wallpaper */}
            <div
              className="flex-1 overflow-y-auto px-3 py-4 md:px-6"
              style={{
                backgroundColor: "#EFEAE2",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc7' fill-opacity='0.35'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              {loadingThread && !thread ? (
                <p className="text-center text-sm text-[#667781]">Loading messages…</p>
              ) : (
                <div className="space-y-1">
                  {threadParts.visibleMessages.map((m) => {
                    const isOutbound = m.direction === "outbound";
                    const isAutomated = m.source === "automated";
                    const reactions = m.wamid
                      ? threadParts.reactionsByWamid.get(m.wamid) ?? []
                      : [];

                    if (isAutomated) {
                      return (
                        <div key={m.id} className="flex flex-col py-1">
                          <div className="flex justify-center">
                            <div className="max-w-[92%] rounded-lg border border-[#D1D7DB] bg-[#FFF8E1] px-3 py-2 shadow-sm">
                              <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#856404]">
                                Automated · {m.automatedLabel}
                              </p>
                              {m.jobCard && (
                                <Link
                                  href={`/jobs/${m.jobCard.id}`}
                                  className="mt-1 block text-center text-xs font-semibold text-[#008069] hover:underline"
                                >
                                  {m.jobCard.jobNumber}
                                  {m.jobCard.status ? ` · ${m.jobCard.status}` : ""}
                                </Link>
                              )}
                              <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#111B21]">
                                {m.body}
                              </p>
                              <p className="mt-1 text-right text-[10px] text-[#667781]">
                                {chatTime(m.createdAt)}
                              </p>
                            </div>
                          </div>
                          {reactions.length > 0 && (
                            <div className="flex justify-center">
                              <ReactionStrip emojis={reactions} />
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col py-0.5 ${isOutbound ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`relative max-w-[82%] px-2.5 py-1.5 shadow-sm ${
                            isOutbound
                              ? "rounded-lg rounded-tr-none bg-[#D9FDD3] text-[#111B21]"
                              : "rounded-lg rounded-tl-none bg-white text-[#111B21]"
                          } ${m.messageType === "image" && m.mediaId ? "p-1" : ""}`}
                        >
                          {m.messageType === "image" && m.mediaId ? (
                            <>
                              <ChatImage
                                mediaId={m.mediaId}
                                alt={m.body?.trim() || "WhatsApp photo"}
                                onOpen={() =>
                                  setLightbox({
                                    mediaId: m.mediaId!,
                                    alt: m.body?.trim() || "WhatsApp photo",
                                  })
                                }
                              />
                              {m.body?.trim() && (
                                <p className="px-1.5 pt-1.5 whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
                                  {m.body}
                                </p>
                              )}
                            </>
                          ) : m.messageType === "image" ? (
                            <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px] text-[#667781]">
                              📷 Photo
                            </p>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
                              {m.body}
                            </p>
                          )}
                          {m.jobCard && (
                            <Link
                              href={`/jobs/${m.jobCard.id}`}
                              className="mt-1 inline-block text-xs font-medium text-[#008069] hover:underline"
                            >
                              {m.jobCard.jobNumber}
                            </Link>
                          )}
                          <p className="mt-0.5 text-right text-[11px] leading-none text-[#667781]">
                            {chatTime(m.createdAt)}
                            {isOutbound && (
                              <span className="ml-1 inline-block text-[#53BDEB]" aria-hidden>
                                ✓✓
                              </span>
                            )}
                          </p>
                        </div>
                        {reactions.length > 0 && <ReactionStrip emojis={reactions} />}
                      </div>
                    );
                  })}
                  {threadParts.orphanReactions.map((m) => (
                    <div key={m.id} className="flex justify-center py-0.5">
                      <div className="rounded-full border border-[#E9EDEF] bg-white px-3 py-1 text-sm shadow-sm">
                        {m.body} · {chatTime(m.createdAt)}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Composer — WhatsApp input bar */}
            <form
              onSubmit={handleSend}
              className="flex items-end gap-2 bg-[#F0F2F5] px-3 py-2 md:px-4"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImagePick}
              />
              <div className="min-w-0 flex-1">
                {error && (
                  <p className="mb-1 text-xs text-red-600">{error}</p>
                )}
                {imagePreview && (
                  <div className="mb-2 flex items-start gap-2 rounded-lg bg-white p-2 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Selected"
                      className="h-16 w-16 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[#111B21]">
                        {pendingImage?.name}
                      </p>
                      <p className="text-[10px] text-[#667781]">
                        Add an optional caption below, then send
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearPendingImage}
                      className="rounded-full p-1 text-[#667781] hover:bg-slate-100"
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1 rounded-3xl bg-white px-2 py-2 shadow-sm">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656F] hover:bg-[#F0F2F5] disabled:opacity-40"
                    aria-label="Attach image"
                  >
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                      <path d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                    </svg>
                  </button>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={1}
                    placeholder={pendingImage ? "Add a caption (optional)" : "Type a message"}
                    className="max-h-24 min-h-[24px] w-full resize-none border-0 bg-transparent px-1 text-[15px] text-[#111B21] outline-none placeholder:text-[#667781]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend(e);
                      }
                    }}
                  />
                </div>
                <p className="mt-1 px-1 text-[10px] text-[#667781]">
                  Replies work within 24 hours of the customer&apos;s last message
                </p>
              </div>
              <button
                type="submit"
                disabled={sending || (!reply.trim() && !pendingImage)}
                className="mb-6 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white shadow-md transition-transform hover:bg-[#006652] disabled:opacity-40"
                aria-label="Send message"
              >
                {sending ? (
                  <span className="text-sm">…</span>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </form>
          </>
        )}
      </div>
      {lightbox && (
        <ImageLightbox
          mediaId={lightbox.mediaId}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
