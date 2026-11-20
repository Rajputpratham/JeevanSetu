import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LanguageProvider } from '@/lib/i18n';
import { SavedProvider } from '@/lib/saved';
import { CompareProvider } from '@/lib/compare';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import QuickSearch from '@/components/home/QuickSearch';
import HomeClient from '@/components/home/HomeClient';
import DiscoveryClient from '@/components/hospitals/DiscoveryClient';

/* ------------------------------------------------------------------ */
/* Mocks                                                                */
/* ------------------------------------------------------------------ */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const mockFetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ results: [], fellBack: false }),
  } as unknown as Response),
);

(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;

const wrap = (children: React.ReactNode) => (
  <LanguageProvider>
    <SavedProvider>
      <CompareProvider>{children}</CompareProvider>
    </SavedProvider>
  </LanguageProvider>
);

beforeEach(() => {
  mockFetch.mockClear();
  window.localStorage.clear();
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
});

/* ------------------------------------------------------------------ */
/* D1 — Search input programmatic name (home + hospitals)             */
/* ------------------------------------------------------------------ */

describe('D1 — Search input accessible name', () => {
  it('homepage search input (qs-q) has an accessible name', () => {
    render(wrap(<QuickSearch />));
    const input = screen.getByLabelText('Search hospital, speciality or city…');
    expect(input).toHaveAttribute('id', 'qs-q');
    expect(input).toHaveAccessibleName('Search hospital, speciality or city…');
  });

  it('hospitals page search input (hosp-search) has an accessible name', () => {
    render(wrap(<DiscoveryClient />));
    const input = screen.getByLabelText('Search by hospital, speciality, city or facility');
    expect(input).toHaveAttribute('id', 'hosp-search');
    expect(input).toHaveAccessibleName('Search by hospital, speciality, city or facility');
  });
});

/* ------------------------------------------------------------------ */
/* D2 — Speciality select programmatic name (home)                    */
/* ------------------------------------------------------------------ */

describe('D2 — Speciality select accessible name', () => {
  it('homepage speciality select (qs-spec) has an accessible name', () => {
    render(wrap(<QuickSearch />));
    const select = screen.getByLabelText('Speciality');
    expect(select).toHaveAttribute('id', 'qs-spec');
    expect(select).toHaveAccessibleName('Speciality');
  });
});

/* ------------------------------------------------------------------ */
/* D3 — Footer heading hierarchy (all pages, footer is global)        */
/* ------------------------------------------------------------------ */

describe('D3 — Footer heading hierarchy', () => {
  it('has no orphaned H3 headings inside contentinfo; section headings are H2', () => {
    const { container } = render(wrap(<Footer />));
    const contentinfo = container.querySelector('footer');
    expect(contentinfo).not.toBeNull();
    expect(contentinfo!.querySelectorAll('h3').length).toBe(0);
    const headings = Array.from(contentinfo!.querySelectorAll('h2')).map(
      (h) => h?.textContent?.trim().toUpperCase(),
    );
    expect(headings).toContain('JEEVANSETU');
    expect(headings).toContain('ABOUT & LEGAL');
    expect(headings).toContain('EMERGENCY');
  });
});

/* ------------------------------------------------------------------ */
/* D4 — Icon-only links use aria-label (all pages, header is global)  */
/* ------------------------------------------------------------------ */

describe('D4 — Icon-only links use aria-label', () => {
  it('Saved link exposes aria-label as its accessible name', () => {
    render(wrap(<Header />));
    const link = screen.getByRole('link', { name: 'Saved (0)' });
    expect(link).toHaveAttribute('aria-label', 'Saved (0)');
  });

  it('Compare link exposes aria-label as its accessible name', () => {
    render(wrap(<Header />));
    const link = screen.getByRole('link', { name: 'Compare hospitals (0 selected)' });
    expect(link).toHaveAttribute('aria-label', 'Compare hospitals (0 selected)');
  });
});

/* ------------------------------------------------------------------ */
/* D5 — FAQ accordion answer exposed when expanded (homepage)         */
/* ------------------------------------------------------------------ */

describe('D5 — FAQ accordion answer exposure', () => {
  it('answer paragraph is present in the DOM when the disclosure is expanded', () => {
    render(wrap(<HomeClient />));
    const summary = screen.getByText('Does JeevanSetu charge any fee?');
    const details = summary.closest('details')!;
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(summary);
    expect(details).toHaveAttribute('open');
    expect(screen.getByText(/No\. JeevanSetu is free/)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* D6 — Filters button stray bullet (hospitals page)                  */
/* ------------------------------------------------------------------ */

describe('D6 — Filters button text', () => {
  it('renders exactly "Filters" with no stray bullet when a filter is active', () => {
    render(wrap(<DiscoveryClient initialQ='AIIMS' />));
    const button = screen.getByRole('button', { name: /^Filters/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.textContent).toBe('Filters');
    expect(button.textContent).not.toContain('•');
  });
});
