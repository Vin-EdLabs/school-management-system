export default function ComingSoonPage({ schoolName }: { schoolName?: string }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      <div className="sw-gold-pattern h-1.5" style={{ background: 'var(--sw-primary)' }} />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-lg text-center">
          <p className="sw-gold-pill">Coming Soon</p>
          <h1 className="sw-serif mt-6 text-4xl md:text-5xl">{schoolName || 'Our School'}</h1>
          <span className="mx-auto mt-6 block h-0.5 w-12 rounded-full" style={{ background: 'var(--sw-gold)' }} />
          <p className="mt-6 text-base leading-relaxed" style={{ color: 'var(--sw-muted)' }}>
            Our new website is being prepared. Please check back soon, or contact the school office
            directly for admissions and enquiries.
          </p>
        </div>
      </div>
      <p className="pb-8 text-center text-xs" style={{ color: 'var(--sw-muted)' }}>
        Powered by ScholarNerve
      </p>
    </div>
  );
}
