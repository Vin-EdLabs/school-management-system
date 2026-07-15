import React, { useState } from 'react';
import { Clock, Mail, MapPin, Phone, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { schoolWebsitePublicService } from '@/services/schoolWebsiteService';
import { useSchoolWebsite } from '../SchoolWebsiteContext';
import { PageHero, Reveal, SectionHeading } from '../SchoolWebsiteLayout';
import ApplicationSuccessScreen from '../components/ApplicationSuccessScreen';

export default function ContactPage() {
  const { slug, data } = useSchoolWebsite();
  const contact = data?.contact || {};
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      setError('Please fill in your name, phone number, and message');
      return;
    }
    setSending(true);
    setError('');
    try {
      await schoolWebsitePublicService.submitContact(slug, form);
      setSent(true);
      setForm({ name: '', phone: '', email: '', message: '' });
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <ApplicationSuccessScreen
        title="Message Sent!"
        message="Thank you for reaching out. Our team will respond within one working day."
      />
    );
  }

  const infoCards = [
    { icon: Phone, label: 'Phone', value: contact.primary_phone || contact.secondary_phone },
    { icon: Mail, label: 'Email', value: contact.email },
    { icon: MapPin, label: 'Location', value: contact.address },
    { icon: Clock, label: 'Working Hours', value: contact.working_hours },
  ].filter((c) => c.value);

  return (
    <>
      <PageHero title="Contact Us" subtitle="We would love to hear from you" />

      <section className="sw-section bg-white">
        <div className="sw-container">
          {/* Info cards */}
          {infoCards.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {infoCards.map(({ icon: Icon, label, value }, i) => (
              <Reveal key={label} delay={i * 100}>
                <div className="sw-card h-full p-8 text-center">
                  <span className="sw-icon-circle mx-auto">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="sw-serif mt-5 text-[22px]">{label}</h3>
                  <span
                    className="mx-auto mt-2 block h-0.5 w-10 rounded-full"
                    style={{ background: 'var(--sw-gold)' }}
                  />
                  <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--sw-muted)' }}>
                    {String(value)}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          )}

          {/* Map */}
          {contact.map_embed_url && (
            <Reveal className="mt-14">
              <iframe
                title="School location"
                src={String(contact.map_embed_url)}
                className="h-[400px] w-full rounded-xl border-0 shadow-sm"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </Reveal>
          )}

          {/* Address + form */}
          <div className="mt-20 grid items-start gap-14 lg:grid-cols-2">
            <Reveal>
              <SectionHeading eyebrow="Visit us" title="Come and see the school for yourself" />
              {contact.address && (
                <div className="flex items-start gap-4">
                  <span className="sw-icon-square shrink-0">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">Our Address</p>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--sw-muted)' }}>
                      {String(contact.address)}
                    </p>
                  </div>
                </div>
              )}
              <p className="sw-prose mt-8">
                Prefer to talk in person? Walk-in visits are welcome during working hours, or send us a
                message and our team will respond within one working day.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <form onSubmit={(e) => void submit(e)} className="sw-card p-8 md:p-10">
                <h2 className="sw-serif text-2xl">Send a message</h2>
                {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
                <div className="mt-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Name *</Label>
                    <Input
                      id="contact-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="sw-field h-11 w-full"
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Phone *</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="sw-field h-11 w-full"
                      placeholder="+233 …"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="sw-field h-11 w-full"
                      placeholder="you@example.com (optional)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-message">Message *</Label>
                    <Textarea
                      id="contact-message"
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="sw-field min-h-[130px] w-full"
                      placeholder="How can we help?"
                      required
                    />
                  </div>
                  <button type="submit" disabled={sending} className="sw-btn sw-btn-primary w-full">
                    <Send className="h-4 w-4" />
                    {sending ? 'Sending…' : 'Send Message'}
                  </button>
                </div>
              </form>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
