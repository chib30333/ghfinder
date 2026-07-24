import { useRef, useState, type ChangeEvent } from 'react';
import { Avatar, Button, Card, InfoTip, Input, Textarea } from '@/components/ui';
import { hue, initials } from '@/lib/avatar';
import { HINTS } from '@/lib/hints';
import type { Profile } from '@/types';
import type { V } from '@/hooks/useApp';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'url';
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block text-[11px] text-muted">
      {props.label}
      <Input
        className="mt-1.5"
        inputSize="lg"
        type={props.type}
        inputMode={props.inputMode}
        mono={props.mono}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

export function ProfileView({ v }: { v: V }) {
  const [draft, setDraft] = useState<Profile>(v.profile);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(v.profile);
  const previewInitials = initials(draft.name || draft.email || '?');
  const previewColor = hue(draft.email || draft.name || '');

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setErr('Image is too large — pick one under 2 MB.');
      return;
    }
    setErr('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setDraft((d) => ({ ...d, avatar: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <section aria-label="Account" data-screen-label="Account">
      <div data-pagehead className="mb-[18px]">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] flex items-center gap-2">
          Account<InfoTip label={HINTS.acctProfile} size={16} />
        </h1>
        <p className="mt-[5px] text-muted text-[13px]">Your operator profile — identity, contact details, and avatar.</p>
      </div>

      <div data-cardcols className="columns-2 gap-[14px] [&>*]:mb-[14px] [&>*]:break-inside-avoid">
        <Card className="p-[18px]">
          <h3 className="text-[14px] font-semibold mb-3.5">Avatar</h3>
          <div className="flex items-center gap-4">
            <Avatar color={previewColor} initials={previewInitials} src={draft.avatar} size={72} fontSize={26} />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button variant="soft" onClick={() => fileRef.current?.click()}>Upload photo</Button>
                {draft.avatar && (
                  <Button variant="ghost" onClick={() => setDraft((d) => ({ ...d, avatar: null }))}>Remove</Button>
                )}
              </div>
              <span className="text-[11px] text-muted">PNG, JPG or GIF — up to 2 MB.</span>
              {err && <span className="text-[11px] text-danger">{err}</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
          </div>
        </Card>

        <Card className="p-[18px]">
          <h3 className="text-[14px] font-semibold mb-3.5">Profile</h3>
          <div className="flex flex-col gap-3">
            <div data-stack className="grid grid-cols-2 gap-3">
              <Field label="Display name" value={draft.name} onChange={(x) => setDraft((d) => ({ ...d, name: x }))} placeholder="Alex" />
              <Field label="Full name" value={draft.fullName} onChange={(x) => setDraft((d) => ({ ...d, fullName: x }))} placeholder="Alex Operator" />
            </div>
            <Field label="Email" type="email" inputMode="email" mono value={draft.email} onChange={(x) => setDraft((d) => ({ ...d, email: x }))} placeholder="you@example.com" />
          </div>
        </Card>

        <Card className="p-[18px]">
          <h3 className="text-[14px] font-semibold mb-3.5">Contact</h3>
          <div className="flex flex-col gap-3">
            <div data-stack className="grid grid-cols-2 gap-3">
              <Field label="Phone" type="tel" inputMode="tel" value={draft.phone} onChange={(x) => setDraft((d) => ({ ...d, phone: x }))} placeholder="+1 555 000 1234" />
              <Field label="Location" value={draft.location} onChange={(x) => setDraft((d) => ({ ...d, location: x }))} placeholder="San Francisco, CA" />
            </div>
            <div data-stack className="grid grid-cols-2 gap-3">
              <Field label="Company" value={draft.company} onChange={(x) => setDraft((d) => ({ ...d, company: x }))} placeholder="ghfinder" />
              <Field label="Website" type="url" inputMode="url" value={draft.website} onChange={(x) => setDraft((d) => ({ ...d, website: x }))} placeholder="https://…" />
            </div>
          </div>
        </Card>

        <Card className="p-[18px]">
          <h3 className="text-[14px] font-semibold mb-3.5">About</h3>
          <label className="block text-[11px] text-muted">
            Bio
            <Textarea className="mt-1.5" rows={4} value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} placeholder="A short bio…" />
          </label>
        </Card>

      </div>

      <div className="flex items-center justify-end gap-2 mt-[14px]">
        <Button variant="soft" onClick={() => { setDraft(v.profile); setErr(''); }} disabled={!dirty}>Reset</Button>
        <Button variant="primary" onClick={() => v.saveProfile(draft)} disabled={!dirty}>Save changes</Button>
      </div>
    </section>
  );
}
