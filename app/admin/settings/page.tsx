'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Settings, Save, Loader2, AlertTriangle, Building2, Percent, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'platform'), snap => {
      const data = snap.data() ?? {};
      setConfig(data);
      setForm({
        registrationFee: String(data.registrationFee ?? 10000),
        sponsorCommission: String(data.sponsorCommission ?? 3500),
        secondTierCommission: String(data.secondTierCommission ?? 1500),
        propertyCommissionPercent: String(data.propertyCommissionPercent ?? 15),
        rentalCommissionPercent: String(data.rentalCommissionPercent ?? 5),
        rtoDepositPercent: String(data.rtoDepositPercent ?? 40),
        rtoInterest10Year: String(data.rtoInterest10Year ?? 20),
        rtoInterest5Year: String(data.rtoInterest5Year ?? 10),
        mortgageProcessingFee: String(data.mortgageProcessingFee ?? 500000),
        wemaBankAccount: String(data.wemaBankAccount ?? '0127772365'),
        wemaBankName: String(data.wemaBankName ?? 'Wema Bank'),
        wemaAccountName: String(data.wemaAccountName ?? 'Felhomes Limited'),
        minWithdrawal: String(data.minWithdrawal ?? 1000),
        minFunding: String(data.minFunding ?? 100),
      });
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function handle(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'config', 'platform'), {
        ...Object.fromEntries(
          Object.entries(form).map(([k, v]) => [k, isNaN(Number(v)) ? v : Number(v)])
        ),
        updatedAt: serverTimestamp(),
      });
      toast.success('Settings saved');
    } catch (e: any) {
      toast.error(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Platform configuration" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-red-100 p-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <p className="font-semibold text-slate-700">Access restricted</p>
            <p className="text-sm text-slate-400">Only Super Admins can modify platform settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#C89B3C]" />
      </div>
    );
  }

  const Section = ({ title, desc, icon: Icon, children }: any) => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[#C89B3C]/10 p-1.5">
            <Icon className="h-4 w-4 text-[#C89B3C]" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {desc && <CardDescription className="text-xs">{desc}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      </CardContent>
    </Card>
  );

  const Field = ({ label, fieldKey, prefix, suffix }: { label: string; fieldKey: string; prefix?: string; suffix?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{prefix}</span>}
        <Input
          value={form[fieldKey] ?? ''}
          onChange={handle(fieldKey)}
          className={prefix ? 'pl-7' : suffix ? 'pr-8' : ''}
          type="number"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{suffix}</span>}
      </div>
    </div>
  );

  const TextField = ({ label, fieldKey }: { label: string; fieldKey: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      <Input value={form[fieldKey] ?? ''} onChange={e => setForm(f => ({ ...f, [fieldKey]: e.target.value }))} />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Business rules and configuration — changes take effect immediately"
        action={
          <Button onClick={save} disabled={saving} className="bg-[#C89B3C] hover:bg-[#b08832] text-white">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        }
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Changes here affect every transaction on the platform. Do not change without authorisation from the Felhomes director.
      </div>

      <Section title="Registration Fees" desc="User onboarding fee split" icon={Wallet}>
        <Field label="Registration fee (₦)" fieldKey="registrationFee" prefix="₦" />
        <Field label="Direct sponsor commission (₦)" fieldKey="sponsorCommission" prefix="₦" />
        <Field label="Second-tier sponsor commission (₦)" fieldKey="secondTierCommission" prefix="₦" />
      </Section>

      <Section title="Property Commissions" desc="Fee splits on property transactions" icon={Building2}>
        <Field label="Property commission (%)" fieldKey="propertyCommissionPercent" suffix="%" />
        <Field label="Rental referrer commission (%)" fieldKey="rentalCommissionPercent" suffix="%" />
      </Section>

      <Section title="Rent-to-Own Rules" desc="RTO payment plan parameters" icon={Percent}>
        <Field label="Initial deposit (%)" fieldKey="rtoDepositPercent" suffix="%" />
        <Field label="10-year plan interest (%)" fieldKey="rtoInterest10Year" suffix="%" />
        <Field label="5-year plan interest (%)" fieldKey="rtoInterest5Year" suffix="%" />
      </Section>

      <Section title="Mortgage" desc="Mortgage processing fee" icon={Building2}>
        <Field label="Processing fee (₦)" fieldKey="mortgageProcessingFee" prefix="₦" />
      </Section>

      <Section title="Bank Details" desc="Felhomes account shown to users for transfers" icon={Building2}>
        <TextField label="Bank name" fieldKey="wemaBankName" />
        <TextField label="Account number" fieldKey="wemaBankAccount" />
        <TextField label="Account name" fieldKey="wemaAccountName" />
      </Section>

      <Section title="Wallet Limits" desc="Minimum transaction amounts" icon={Wallet}>
        <Field label="Min withdrawal (₦)" fieldKey="minWithdrawal" prefix="₦" />
        <Field label="Min wallet funding (₦)" fieldKey="minFunding" prefix="₦" />
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-[#C89B3C] hover:bg-[#b08832] text-white">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save all changes
        </Button>
      </div>
    </div>
  );
}
