"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/jobs";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
  direction: "inbound" | "outbound";
  messageType: string;
  body: string | null;
  status: string;
  createdAt: string;
  jobCard?: { id: string; jobNumber: string } | null;
};

type ThreadData = {
  conversation: Conversation & { unreadCount: number };
  messages: Message[];
};

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

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/admin/whatsapp/conversations");
    if (!res.ok) return;
    const data = await res.json();
    setConversations(data.conversations ?? []);
    onUnreadChange?.(data.totalUnread ?? 0);
    setLoadingList(false);
  }, [onUnreadChange]);

  const loadThread = useCallback(async (conversationId: string) => {
    setLoadingThread(true);
    setError("");
    const res = await fetch(
      `/api/admin/whatsapp/conversations/${conversationId}/messages`
    );
    if (!res.ok) {
      setError("Failed to load messages");
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
  }, [loadConversations]);

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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !reply.trim()) return;

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

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="max-h-[70vh] overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Conversations</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[calc(70vh-3rem)] overflow-y-auto p-0">
          {loadingList ? (
            <p className="px-3 py-4 text-sm text-slate-500">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">
              No messages yet. Replies appear here after the webhook is configured.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                      selectedId === c.id ? "bg-emerald-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {c.customerName ?? c.mobileDisplay}
                        </p>
                        {c.customerName && (
                          <p className="text-xs text-slate-500">{c.mobileDisplay}</p>
                        )}
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    {c.lastMessagePreview && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">
                        {c.lastMessagePreview}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {formatDateTime(c.lastMessageAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="flex max-h-[70vh] flex-col overflow-hidden">
        {!selectedId ? (
          <CardContent className="flex flex-1 items-center justify-center py-12">
            <p className="text-sm text-slate-500">Select a conversation</p>
          </CardContent>
        ) : loadingThread && !thread ? (
          <CardContent className="flex flex-1 items-center justify-center py-12">
            <p className="text-sm text-slate-500">Loading messages…</p>
          </CardContent>
        ) : (
          <>
            <CardHeader className="border-b border-slate-100 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">
                    {active?.customerName ?? active?.mobileDisplay}
                  </CardTitle>
                  {active?.customerName && (
                    <p className="text-xs text-slate-500">{active.mobileDisplay}</p>
                  )}
                </div>
                {active?.latestJob && (
                  <Link
                    href={`/jobs/${active.latestJob.id}`}
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    {active.latestJob.jobNumber} · {active.latestJob.status}
                  </Link>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {thread?.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${
                      m.direction === "outbound" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        m.direction === "outbound"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          m.direction === "outbound"
                            ? "text-emerald-100"
                            : "text-slate-500"
                        }`}
                      >
                        {formatDateTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleSend}
                className="border-t border-slate-100 p-3"
              >
                {error && (
                  <p className="mb-2 text-xs text-red-600">{error}</p>
                )}
                <p className="mb-2 text-[10px] text-slate-500">
                  Free-form replies work within 24 hours of the customer&apos;s last
                  message.
                </p>
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder="Type a reply…"
                    className="min-h-[2.5rem] flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={sending || !reply.trim()}
                    className="shrink-0 self-end rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {sending ? "…" : "Send"}
                  </button>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
