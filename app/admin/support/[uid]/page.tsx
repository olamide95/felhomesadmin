'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  ref as _unused,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, auth, storage } from '@/lib/firebase';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Send,
  Paperclip,
  Loader2,
  User as UserIcon,
  Mail,
  Copy,
  Check,
  X,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'admin';
  body: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  createdAt: { seconds: number } | null;
  adminUid?: string;
  adminName?: string;
}

interface UserProfile {
  uid: string;
  fullName?: string;
  email?: string;
  phone?: string;
  referralCode?: string;
  registrationFeePaid?: boolean;
  accountActive?: boolean;
  createdAt?: { seconds: number } | null;
}

function formatDateTime(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportThreadDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    // Messages listener + mark admin-read on open.
    const q = query(
      collection(db, 'support_threads', uid, 'messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(200)
    );
    const unsubMessages = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Message, 'id'>),
          }))
        );
        setLoading(false);
        // Scroll to bottom after render.
        setTimeout(() => {
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }, 50);
      },
      (err) => {
        toast.error(`Failed to load messages: ${err.message}`);
        setLoading(false);
      }
    );

    // Fetch user profile (one-shot).
    getDoc(doc(db, 'users', uid))
      .then((snap) => {
        if (snap.exists()) {
          setUserProfile({ uid, ...(snap.data() as Omit<UserProfile, 'uid'>) });
        } else {
          setUserProfile({ uid });
        }
      })
      .catch(() => setUserProfile({ uid }));

    // Reset adminUnreadCount when we open the thread.
    updateDoc(doc(db, 'support_threads', uid), {
      adminUnreadCount: 0,
    }).catch(() => {});

    return () => unsubMessages();
  }, [uid]);

  async function handleSend() {
    if (!uid) return;
    if (!reply.trim() && !pendingFile) return;
    const admin = auth.currentUser;
    if (!admin) {
      toast.error('You must be signed in.');
      return;
    }

    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      let attachmentType: string | undefined;
      let attachmentSize: number | undefined;

      if (pendingFile) {
        if (pendingFile.size > 8 * 1024 * 1024) {
          throw new Error('File must be under 8 MB');
        }
        const stamp = Date.now();
        const ext = pendingFile.name.split('.').pop()?.toLowerCase() || 'bin';
        const path = `support_attachments/${uid}/admin_${stamp}_${pendingFile.name}`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, pendingFile, {
          contentType: pendingFile.type,
        });
        attachmentUrl = await getDownloadURL(ref);
        attachmentName = pendingFile.name;
        attachmentType = pendingFile.type.startsWith('image/')
          ? 'image'
          : pendingFile.type === 'application/pdf'
          ? 'pdf'
          : 'other';
        attachmentSize = pendingFile.size;
      }

      const body = reply.trim();
      const displayBody = body
        ? body
        : attachmentType === 'image'
        ? '📷 Image'
        : '📎 Attachment';

      // Add the message.
      await addDoc(collection(db, 'support_threads', uid, 'messages'), {
        sender: 'admin',
        body,
        ...(attachmentUrl ? { attachmentUrl } : {}),
        ...(attachmentName ? { attachmentName } : {}),
        ...(attachmentType ? { attachmentType } : {}),
        ...(attachmentSize ? { attachmentSizeBytes: attachmentSize } : {}),
        adminUid: admin.uid,
        adminName: admin.displayName || 'Felhomes Support',
        createdAt: serverTimestamp(),
      });

      // Update thread metadata + bump user unread. This ALSO fires the
      // onSupportMessageCreated Cloud Function which pushes to the user.
      await updateDoc(doc(db, 'support_threads', uid), {
        lastMessageBody:
          displayBody.length > 140
            ? `${displayBody.substring(0, 137)}...`
            : displayBody,
        lastMessageAt: serverTimestamp(),
        lastMessageSender: 'admin',
        userUnreadCount: (await getDoc(doc(db, 'support_threads', uid)))
          .data()?.userUnreadCount
          ? // increment
            (((await getDoc(doc(db, 'support_threads', uid))).data()!
              .userUnreadCount as number) + 1)
          : 1,
      });

      setReply('');
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Reply sent.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send.');
    } finally {
      setSending(false);
    }
  }

  async function handleCloseThread() {
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'support_threads', uid), { status: 'closed' });
      toast.success('Thread closed.');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleReopenThread() {
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'support_threads', uid), { status: 'open' });
      toast.success('Thread reopened.');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function copyUid() {
    if (!uid) return;
    navigator.clipboard.writeText(uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin/support"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        All threads
      </Link>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Chat area */}
        <div className="lg:col-span-3 space-y-4">
          <PageHeader
            title={userProfile?.fullName || 'Unnamed user'}
            description={userProfile?.email || ''}
          />
          <Card className="h-[600px] flex flex-col">
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12">
                  No messages yet.
                </div>
              ) : (
                messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))
              )}
            </div>

            <div className="border-t p-3 space-y-2">
              {pendingFile && (
                <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                  {pendingFile.type.startsWith('image/') ? (
                    <ImageIcon className="h-4 w-4 text-amber-700" />
                  ) : (
                    <FileText className="h-4 w-4 text-amber-700" />
                  )}
                  <span className="flex-1 truncate">{pendingFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(pendingFile.size / 1024).toFixed(0)} KB
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPendingFile(null);
                      if (fileInputRef.current)
                        fileInputRef.current.value = '';
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPendingFile(f);
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  placeholder="Type a reply..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={3}
                  disabled={sending}
                  className="flex-1 resize-none"
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || (!reply.trim() && !pendingFile)}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Send
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⌘/Ctrl + Enter to send · Attachments max 8 MB · Images and PDFs
              </p>
            </div>
          </Card>
        </div>

        {/* User info sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-xs uppercase font-semibold text-muted-foreground">
                User
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <UserIcon className="h-5 w-5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {userProfile?.fullName || '—'}
                  </div>
                  {userProfile?.email && (
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {userProfile.email}
                    </div>
                  )}
                  {userProfile?.phone && (
                    <div className="text-xs text-muted-foreground">
                      {userProfile.phone}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">uid</span>
                  <button
                    onClick={copyUid}
                    className="font-mono flex items-center gap-1 hover:text-amber-700"
                  >
                    {uid?.slice(0, 8)}…
                    {copied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
                {userProfile?.referralCode && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Referral</span>
                    <span className="font-mono">{userProfile.referralCode}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Reg fee paid</span>
                  <span>
                    {userProfile?.registrationFeePaid ? '✅' : '❌'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Account active</span>
                  <span>
                    {userProfile?.accountActive !== false ? '✅' : '❌'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Joined</span>
                  <span>{formatDateTime(userProfile?.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">
                Actions
              </div>
              <Link
                href={`/admin/users/${uid}`}
                className="block w-full text-sm text-center py-2 border rounded hover:bg-muted"
              >
                View full user profile →
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleCloseThread}
              >
                Close thread
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleReopenThread}
              >
                Reopen thread
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isAdmin = message.sender === 'admin';
  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isAdmin
            ? 'bg-amber-600 text-white'
            : 'bg-muted text-foreground'
        }`}
      >
        {isAdmin && message.adminName && (
          <div className="text-[10px] font-semibold opacity-80 mb-1">
            {message.adminName}
          </div>
        )}
        {message.attachmentUrl && (
          <div className="mb-2">
            {message.attachmentType === 'image' ? (
              <a
                href={message.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={message.attachmentUrl}
                  alt="attachment"
                  className="rounded max-h-64 object-cover"
                />
              </a>
            ) : (
              <a
                href={message.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 rounded px-2 py-1 text-xs ${
                  isAdmin ? 'bg-amber-700' : 'bg-background'
                }`}
              >
                <FileText className="h-3 w-3" />
                {message.attachmentName || 'Attachment'}
              </a>
            )}
          </div>
        )}
        {message.body && (
          <div className="text-sm whitespace-pre-wrap">{message.body}</div>
        )}
        <div
          className={`text-[10px] mt-1 ${
            isAdmin ? 'text-amber-100' : 'text-muted-foreground'
          }`}
        >
          {formatDateTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
