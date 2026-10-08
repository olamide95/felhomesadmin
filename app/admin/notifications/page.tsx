'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { Bell, Send, Loader2, Users, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { Paths, formatDateTime } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/constants';

interface NotifLog {
  id: string;
  title?: string;
  body?: string;
  audience?: string;
  sentBy?: string;
  sentAt?: { seconds: number };
  recipientCount?: number;
}

export default function NotificationsPage() {
  const { adminUser } = useAuth();
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'notification_broadcasts'), orderBy('sentAt', 'desc')),
      snap => { setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as NotifLog))); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  async function send() {
    if (!title.trim() || !body.trim()) { toast.error('Title and message required'); return; }
    setSending(true);
    try {
      await addDoc(collection(db, 'notification_broadcasts'), {
        title: title.trim(),
        body: body.trim(),
        audience,
        sentBy: adminUser?.uid,
        sentByEmail: adminUser?.email,
        sentAt: serverTimestamp(),
        status: 'queued',
      });
      toast.success('Notification queued — Cloud Functions will deliver it');
      setTitle(''); setBody(''); setAudience('all');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Send push notifications to users"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Compose */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-[#C89B3C]/10 p-1.5">
                <Megaphone className="h-4 w-4 text-[#C89B3C]" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Send notification</CardTitle>
                <CardDescription className="text-xs">Delivered via FCM push notification</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />All users
                    </div>
                  </SelectItem>
                  <SelectItem value="paid">Paid users only</SelectItem>
                  <SelectItem value="unpaid">Unpaid users only</SelectItem>
                  <SelectItem value="investors">Active investors</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. New properties just listed!" maxLength={65} />
              <p className="text-[10px] text-slate-400 text-right">{title.length}/65</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Message</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)}
                placeholder="e.g. Check out the latest rent-to-own listings in Abuja — spots filling fast." rows={4} maxLength={200} />
              <p className="text-[10px] text-slate-400 text-right">{body.length}/200</p>
            </div>

            {title && body && (
              <div className="rounded-xl border border-slate-200 bg-slate-900 p-4">
                <p className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wide">Preview</p>
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-[#C89B3C]/20 flex items-center justify-center shrink-0">
                    <Bell className="h-4 w-4 text-[#C89B3C]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{body}</p>
                  </div>
                </div>
              </div>
            )}

            <Button onClick={send} disabled={sending || !title.trim() || !body.trim()}
              className="w-full bg-[#C89B3C] hover:bg-[#b08832] text-white">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send to {audience === 'all' ? 'all users' : audience}
            </Button>

            <p className="text-xs text-slate-400 text-center">
              Notifications are queued and delivered by Cloud Functions. Delivery depends on users having notifications enabled.
            </p>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Broadcast history</CardTitle>
            <CardDescription className="text-xs">Recent notifications sent from the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">No broadcasts yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map(log => (
                  <div key={log.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{log.title}</p>
                      <Badge className="text-[9px] bg-green-100 text-green-800 border-green-200 shrink-0">Sent</Badge>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2">{log.body}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>To: {log.audience ?? 'all'}</span>
                      <span>{formatDateTime(log.sentAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
