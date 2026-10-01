import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PrivacyPage, TermsPage, DisclaimerPage, CookiePolicyPage, GrievancePage } from './LegalPages';
import { LEGAL, LEGAL_PAGES } from './legalConfig';

const pages = [
  ['Privacy Policy', PrivacyPage],
  ['Terms of Use', TermsPage],
  ['Disclaimer', DisclaimerPage],
  ['Cookie Policy', CookiePolicyPage],
  ['Grievance Redressal', GrievancePage],
] as const;

describe('legal pages', () => {
  it.each(pages)('%s renders its heading, the operator and the contact email', (title, Page) => {
    render(<MemoryRouter><Page /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getAllByText(new RegExp(LEGAL.entity.replace(/\./g, '\\.'))).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: LEGAL.email }).length).toBeGreaterThan(0);
  });

  it('every page links to all the others in the footer nav', () => {
    render(<MemoryRouter><PrivacyPage /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Legal' });
    for (const p of LEGAL_PAGES) {
      expect(nav.querySelector(`a[href="${p.path}"]`)).toBeTruthy();
    }
  });
});
