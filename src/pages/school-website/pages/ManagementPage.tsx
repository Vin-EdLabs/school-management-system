import React from 'react';
import { useSchoolWebsite } from '../SchoolWebsiteContext';
import { PageHero, Reveal, SectionHeading } from '../SchoolWebsiteLayout';
import { TeamMemberPhoto, resolveTeamPhotoUrl } from '../components/TeamMemberPhoto';

type TeamMember = {
  id: number;
  member_type: 'leadership' | 'teacher';
  position: string;
  full_name: string;
  photo_url: string | null;
  bio: string | null;
  subjects: string[];
};

function formatRole(position: string, memberType: TeamMember['member_type']) {
  const raw = String(position || '').trim();
  const legacy: Record<string, string> = {
    proprietor: 'Proprietor',
    headmaster: 'Headmaster / Headmistress',
    finance_officer: 'Finance Officer',
    administrator: 'School Administrator',
    other: 'Administrative Staff',
  };
  if (raw && legacy[raw.toLowerCase()]) return legacy[raw.toLowerCase()];
  if (raw) return raw;
  return memberType === 'teacher' ? 'Teacher' : 'Staff';
}

function TeamMemberBlock({
  member,
  schoolName,
  reverse = false,
}: {
  member: TeamMember;
  schoolName: string;
  reverse?: boolean;
}) {
  const photo = resolveTeamPhotoUrl(member.photo_url);
  const role = formatRole(member.position, member.member_type);

  return (
    <div
      className={`grid items-center gap-10 lg:grid-cols-[340px,1fr] lg:gap-14 ${
        reverse ? 'lg:[direction:rtl]' : ''
      }`}
    >
      {photo ? (
        <div className={reverse ? 'lg:[direction:ltr]' : undefined}>
          <TeamMemberPhoto src={photo} alt={member.full_name} />
        </div>
      ) : null}

      <Reveal delay={120} className={reverse ? 'lg:[direction:ltr]' : undefined}>
        <p className="sw-eyebrow">{member.member_type === 'teacher' ? 'Teaching staff' : 'Leadership'}</p>
        <h2 className="sw-serif mt-3 text-3xl leading-tight md:text-[36px]">{member.full_name}</h2>
        {member.bio ? (
          <>
            <span className="sw-serif mt-6 block text-[64px] leading-[0.5] text-[var(--sw-gold)] md:text-[80px]" aria-hidden>
              “
            </span>
            <blockquote className="sw-serif mt-4 text-lg font-semibold italic leading-snug md:text-xl">
              {member.bio}
            </blockquote>
          </>
        ) : null}
        <div className="mt-8 flex items-center gap-4">
          <span className="h-px w-12 shrink-0" style={{ background: 'var(--sw-gold)' }} />
          <div>
            <p className="font-semibold" style={{ color: 'var(--sw-text)' }}>
              {member.full_name}
            </p>
            <p className="text-sm" style={{ color: 'var(--sw-muted)' }}>
              {role}
              {member.member_type === 'leadership' ? `, ${schoolName}` : ''}
            </p>
            {member.member_type === 'teacher' && member.subjects?.length > 0 && (
              <p className="mt-1 text-sm font-medium" style={{ color: 'var(--sw-primary)' }}>
                {member.subjects.join(' · ')}
              </p>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

export default function ManagementPage() {
  const { data, schoolName } = useSchoolWebsite();
  const management = data?.management as
    | { leadership?: TeamMember[]; teachers?: TeamMember[] }
    | undefined;

  const leadership = management?.leadership || [];
  const teachers = management?.teachers || [];
  const hasContent = leadership.length > 0 || teachers.length > 0;

  return (
    <>
      <PageHero
        title="Our Management"
        subtitle="Meet the leadership and teaching team guiding our school"
      />

      {!hasContent ? (
        <section className="sw-section bg-white">
          <div className="sw-container py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--sw-muted)' }}>
              Team profiles will appear here once published by the school.
            </p>
          </div>
        </section>
      ) : (
        <>
          {leadership.length > 0 && (
            <section className="sw-section bg-white">
              <div className="sw-container space-y-20 md:space-y-24">
                <SectionHeading eyebrow="Our leaders" title="Leadership board" />
                {leadership.map((member, i) => (
                  <TeamMemberBlock
                    key={member.id}
                    member={member}
                    schoolName={schoolName}
                    reverse={i % 2 === 1}
                  />
                ))}
              </div>
            </section>
          )}

          {teachers.length > 0 && (
            <section className="sw-section" style={{ background: 'var(--sw-cream)' }}>
              <div className="sw-container space-y-20 md:space-y-24">
                <SectionHeading eyebrow="Teaching staff" title="Our teachers" centered />
                {teachers.map((member, i) => (
                  <TeamMemberBlock
                    key={member.id}
                    member={member}
                    schoolName={schoolName}
                    reverse={i % 2 === 1}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
