'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ThemeToggle } from './theme-toggle';
import { WalletButton } from './wallet-button';
import { IntegrationStatus } from './integration-status';
import { Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

type LandingSection = 'intro' | 'capabilities' | 'workflow';

const landingNavItems: ReadonlyArray<{
  type: 'section';
  sectionId: LandingSection;
  label: string;
}> = [
  { type: 'section', sectionId: 'intro', label: 'Intro' },
  { type: 'section', sectionId: 'capabilities', label: 'Capabilities' },
  { type: 'section', sectionId: 'workflow', label: 'Workflow' },
] as const;

const appNavItems: ReadonlyArray<{ type: 'route'; href: string; label: string }> = [
  { type: 'route', href: '/', label: 'Home' },
  { type: 'route', href: '/dashboard', label: 'Dashboard' },
  { type: 'route', href: '/logs', label: 'Logs' },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<LandingSection>('intro');
  const isLandingPage = pathname === '/';
  const navItems = isLandingPage ? landingNavItems : appNavItems;

  useEffect(() => {
    if (pathname !== '/') return;

    const storedTarget = window.sessionStorage.getItem('relay-scroll-target');
    if (storedTarget && isLandingSection(storedTarget)) {
      window.sessionStorage.removeItem('relay-scroll-target');
      window.setTimeout(() => scrollToSection(storedTarget), 80);
      return;
    }
    window.sessionStorage.removeItem('relay-scroll-target');

    const hashTarget = window.location.hash.replace('#', '') as LandingSection;
    if (isLandingSection(hashTarget)) {
      window.setTimeout(() => scrollToSection(hashTarget), 80);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') return;

    const sections = landingSections
      .map((sectionId) => document.getElementById(sectionId))
      .filter((section): section is HTMLElement => Boolean(section));

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleSection && isLandingSection(visibleSection.target.id)) {
          setActiveSection(visibleSection.target.id);
        }
      },
      {
        rootMargin: '-34% 0px -48% 0px',
        threshold: [0.05, 0.2, 0.45, 0.7],
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  const handleSectionClick =
    (sectionId: LandingSection) => (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      if (pathname === '/') {
        scrollToSection(sectionId);
        setActiveSection(sectionId);
        return;
      }

      window.sessionStorage.setItem('relay-scroll-target', sectionId);
      router.push('/', { scroll: false });
    };

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center px-3 pt-4 sm:px-4 sm:pt-6">
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto w-full max-w-5xl rounded-full border border-border bg-background/75 shadow-lg shadow-emerald-500/5 backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/20 dark:shadow-emerald-500/5"
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="group flex shrink-0 items-center gap-2" aria-label="RelayX">
            <Terminal className="h-5 w-5 text-emerald-500 transition-transform duration-200 group-hover:scale-110 group-hover:text-cyan-400" />
            <span className="hidden font-mono text-base font-bold tracking-tight sm:inline">
              RelayX
            </span>
          </div>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {navItems.map((item) => {
              const isSection = item.type === 'section';
              const href = isSection ? `/#${item.sectionId}` : item.href;
              const isActive = isSection
                ? isLandingPage && activeSection === item.sectionId
                : pathname === item.href;

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={isSection ? handleSectionClick(item.sectionId) : undefined}
                  className={cn(
                    'shrink-0 rounded-full border border-transparent px-3 py-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-500/20 hover:bg-accent hover:text-foreground',
                    isActive &&
                      'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 shadow-[0_0_18px_rgba(16,185,129,0.12)] dark:text-emerald-300'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <IntegrationStatus />
            <WalletButton />
            <ThemeToggle />
          </div>
        </div>
      </motion.header>
    </div>
  );
}

const landingSections: LandingSection[] = ['intro', 'capabilities', 'workflow'];

function isLandingSection(value: string): value is LandingSection {
  return landingSections.includes(value as LandingSection);
}

function scrollToSection(sectionId: LandingSection) {
  const target = document.getElementById(sectionId);
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `/#${sectionId}`);
}
