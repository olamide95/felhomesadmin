'use client';

import { useEffect, useRef, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query, doc,
  addDoc, updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { MessageSquare, Send, Loader2, CheckCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { Paths, formatDateTime } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface Thread {
  id: string;
  uid: string;
  userFullName?: string;
  userEmail?: string;
  lastMessage?: string;
  lastMessageAt?: { seconds: number };
  unreadByAdmin?: boolean;
  status?: string;
  createdAt?: { seconds: number };
}

interface Message {
  id: string;
  text: string;
  senderRole: 'user' | 'admin';
  senderName?: string;
  createdAt?: { seconds: number };
}

export default function SupportPage() {
  const { adminUser } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, Paths.supportThreads), orderBy('lastMessageAt', 'desc')),
      snap => {
        setThreads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Thread)));
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const unsub = onSnapshot(
      query(collection(db, Paths.supportThreads, selected.id, 'messages'), orderBy('createdAt', 'asc')),
      snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    );
    // Mark as read
    updateDoc(doc(db, Paths.supportThreads, selected.id), { unreadByAdmin: false }).catch(() => {});
    return () => unsub();
  }, [selected?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      const text = reply.trim();
      setReply('');
      await addDoc(collection(db, Paths.supportThreads, selected.id, 'messages'), {
        text,
        senderRole: 'admin',
        senderName: adminUser?.displayName ?? adminUser?.email ?? 'Support',
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, Paths.supportThreads, selected.id), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        unreadByUser: true,
        unreadByAdmin: false,
      });
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  const unreadCount = threads.filter(t => t.unreadByAdmin).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Chat"
        description={`${threads.length} thread${threads.length !== 1 ? 's' : ''}${unreadCount > 0 ? ` · ${unreadCount} unread` : ''}`}
      />

      <div className="grid gap-4 lg:grid-cols-3 h-[calc(100vh-200px)] min-h-[500px]">
        {/* Thread list */}
        <Card className="lg:col-span-1 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-100 shrink-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : threads.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={MessageSquare} title="No conversations" message="User messages will appear here." />
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {threads.map(t => (
                  <button key={t.id} onClick={() => setSelected(t)}
                    className={cn('w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors',
                      selected?.id === t.id && 'bg-[#C89B3C]/5 border-r-2 border-[#C89B3C]')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-[#C89B3C]/10 flex items-center justify-center shrink-0 text-xs font-bold text-[#C89B3C]">
                          {(t.userFullName ?? t.userEmail ?? 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{t.userFullName ?? t.userEmail ?? t.uid.slice(0, 12)}</p>
                          <p className="text-[10px] text-slate-400 truncate">{t.lastMessage ?? '—'}</p>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <p className="text-[9px] text-slate-300">{formatDateTime(t.lastMessageAt)}</p>
                        {t.unreadByAdmin && (
                          <div className="h-2 w-2 rounded-full bg-[#C89B3C]" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Message pane */}
        <Card className="lg:col-span-2 overflow-hidden flex flex-col">
          {!selected ? (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Select a conversation to view messages</p>
              </div>
            </CardContent>
          ) : (
            <>
              {/* Thread header */}
              <div className="border-b border-slate-100 px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#C89B3C]/10 flex items-center justify-center text-xs font-bold text-[#C89B3C]">
                    {(selected.userFullName ?? selected.userEmail ?? 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{selected.userFullName ?? 'User'}</p>
                    <p className="text-xs text-slate-400">{selected.userEmail} · {selected.uid.slice(0, 10)}…</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-slate-300 py-8">No messages yet</p>
                )}
                {messages.map(m => (
                  <div key={m.id} className={cn('flex', m.senderRole === 'admin' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[75%] rounded-2xl px-3.5 py-2.5',
                      m.senderRole === 'admin'
                        ? 'bg-[#C89B3C] text-white rounded-tr-sm'
                        : 'bg-slate-100 text-slate-800 rounded-tl-sm')}>
                      {m.senderRole === 'admin' && (
                        <p className="text-[9px] font-semibold opacity-70 mb-0.5">{m.senderName ?? 'Support'}</p>
                      )}
                      <p className="text-sm leading-relaxed">{m.text}</p>
                      <p className={cn('text-[9px] mt-1', m.senderRole === 'admin' ? 'text-white/60 text-right' : 'text-slate-400')}>
                        {formatDateTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              <div className="border-t border-slate-100 p-3 shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Type your reply…"
                    rows={2}
                    className="resize-none text-sm"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
                    }}
                  />
                  <Button onClick={sendReply} disabled={sending || !reply.trim()}
                    className="self-end bg-[#C89B3C] hover:bg-[#b08832] text-white px-3">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">Enter to send · Shift+Enter for new line</p>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
