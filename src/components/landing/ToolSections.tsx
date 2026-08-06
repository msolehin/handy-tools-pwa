import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock, Archive } from 'lucide-react';
import { DEFAULT_TOOLS, MAIN_TOOLS, SIDE_TOOLS } from '../../lib/tools';
import { useCopy } from './copy';

// The two groups carry a real distinction: one is driven by a date, the other is a record you
// look things up in. Ordered by which bites you soonest.
const DEADLINE_DRIVEN = new Set([
  '/document-expiry', '/tenancy', '/commitments', '/asset-warranty',
  '/vehicle-services', '/home-services', '/birthdays', '/countdown', '/debt-tracker',
]);

const ToolCard: React.FC<{ tool: typeof DEFAULT_TOOLS[number] }> = ({ tool }) => {
  const { t } = useCopy();
  const { Icon } = tool;
  return (
    <li>
      <Link
        to={tool.to}
        className="group flex h-full flex-col rounded-2xl border border-text/10 bg-surface/40 p-5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-text/25 hover:bg-surface/70 hover:shadow-lg hover:shadow-black/20"
      >
        <div className="flex items-start justify-between gap-3">
          <div className={`rounded-xl p-2.5 ${tool.iconBgClass}`}>
            <Icon size={20} />
          </div>
          <ArrowUpRight
            size={17}
            className="mt-1 shrink-0 text-muted/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text"
          />
        </div>
        <p className="mt-4 font-semibold leading-tight text-text">{tool.title}</p>
        <p className="mt-1.5 text-sm leading-snug text-muted">{t.reminds[tool.to] ?? tool.desc}</p>
      </Link>
    </li>
  );
};

const GroupHeading: React.FC<{ Icon: React.ElementType; children: React.ReactNode; note: string }> = ({
  Icon, children, note,
}) => (
  <div className="mb-5 flex items-baseline gap-3">
    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-text">
      <Icon size={14} className="text-primary" />
      {children}
    </span>
    <span className="h-px flex-1 bg-text/10" />
    <span className="shrink-0 text-xs text-muted">{note}</span>
  </div>
);

const ToolSections: React.FC = () => {
  const { t } = useCopy();
  const deadlines = MAIN_TOOLS.filter((tool) => DEADLINE_DRIVEN.has(tool.to));
  const records = MAIN_TOOLS.filter((tool) => !DEADLINE_DRIVEN.has(tool.to));

  return (
    <>
      <section id="tools" className="mx-auto w-full max-w-6xl scroll-mt-8 px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
            {t.tools.heading}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            {t.tools.body(MAIN_TOOLS.length)}
          </p>
        </div>

        <div className="mt-14">
          <GroupHeading Icon={Clock} note={t.tools.count(deadlines.length)}>
            {t.tools.deadlineGroup}
          </GroupHeading>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deadlines.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
          </ul>
        </div>

        <div className="mt-14">
          <GroupHeading Icon={Archive} note={t.tools.count(records.length)}>
            {t.tools.recordGroup}
          </GroupHeading>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 lg:pb-24">
        <div className="rounded-3xl border border-text/10 bg-surface/25 p-6 backdrop-blur-sm sm:p-9">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t.tools.sideHeading}
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
                {t.tools.sideBody}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted">{t.tools.count(SIDE_TOOLS.length)}</span>
          </div>

          <ul className="mt-6 flex flex-wrap gap-2.5">
            {SIDE_TOOLS.map((tool) => {
              const { Icon } = tool;
              const external = tool.to.startsWith('http');
              const inner = (
                <>
                  <span className={`rounded-lg p-1.5 ${tool.iconBgClass}`}>
                    <Icon size={15} />
                  </span>
                  <span className="font-medium">{tool.title}</span>
                  <ArrowUpRight size={14} className="text-muted/40 transition-colors group-hover:text-text" />
                </>
              );
              const cls = 'group inline-flex items-center gap-2.5 rounded-2xl border border-text/10 bg-surface/60 py-2 pl-2 pr-3.5 text-sm transition-all hover:-translate-y-0.5 hover:border-text/30 hover:bg-surface';
              return (
                <li key={tool.id}>
                  {external
                    ? <a href={tool.to} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                    : <Link to={tool.to} className={cls}>{inner}</Link>}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
};

export default ToolSections;
