import type { Meta, StoryObj } from '@storybook/react';
import { Caption, Code, Display, Heading, Label, Text } from './Typography';

/**
 * # Typography System
 * 
 * SC Fleet Manager uses a cohesive typography system based on a **Major Third (1.25) scale**
 * for harmonious visual rhythm. The system includes components for every text use case:
 * 
 * - **Display**: Hero text, large promotional content
 * - **Heading**: Page and section titles (H1-H6)
 * - **Text**: Body copy with size and weight variants
 * - **Label**: Form labels and UI indicators
 * - **Caption**: Metadata, timestamps, helper text
 * - **Code**: Inline and block code snippets
 * 
 * ## Typography Scale
 * 
 * | Token | Size | Use Case |
 * |-------|------|----------|
 * | 6xl | 72px | Large display |
 * | 5xl | 60px | Display |
 * | 4xl | 48px | H1 |
 * | 3xl | 36px | H2 |
 * | 2xl | 30px | H3 |
 * | xl | 24px | H4 |
 * | lg | 20px | Large body |
 * | base | 16px | Body |
 * | sm | 14px | Small |
 * | xs | 12px | Caption |
 * 
 * ## Design Guidelines
 * 
 * - **Display text** uses tight letter-spacing (-0.02em) for better visual balance
 * - **Headings** use semi-bold to bold weight for hierarchy
 * - **Body text** uses normal weight with relaxed line-height for readability
 * - All sizes are **fluid** using CSS `clamp()` for responsive scaling
 */
export const meta: Meta = {
  title: 'Design System/Typography',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A comprehensive typography system for SC Fleet Manager',
      },
    },
  },
};

// ============================================================================
// Display Stories
// ============================================================================

export const DisplayComponent: StoryObj = {
  name: 'Display',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <Caption>Display Large (72px fluid)</Caption>
        <Display size="lg">Fleet Commander</Display>
      </div>
      <div>
        <Caption>Display Medium (60px fluid)</Caption>
        <Display size="md">Welcome Back</Display>
      </div>
      <div>
        <Caption>Display Small (48px fluid)</Caption>
        <Display size="sm">Your Organization</Display>
      </div>
      <div>
        <Caption>Display with Gradient</Caption>
        <Display size="md" gradient>
          Star Citizen Fleet Manager
        </Display>
      </div>
    </div>
  ),
};

// ============================================================================
// Heading Stories
// ============================================================================

export const HeadingComponent: StoryObj = {
  name: 'Heading',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Caption>H1 - Page Title (48px fluid)</Caption>
        <Heading level={1}>Fleet Management Dashboard</Heading>
      </div>
      <div>
        <Caption>H2 - Section Title (36px fluid)</Caption>
        <Heading level={2}>Active Operations</Heading>
      </div>
      <div>
        <Caption>H3 - Subsection (30px fluid)</Caption>
        <Heading level={3}>Ship Inventory</Heading>
      </div>
      <div>
        <Caption>H4 - Card Title (24px fluid)</Caption>
        <Heading level={4}>Mining Fleet</Heading>
      </div>
      <div>
        <Caption>H5 - Group Title (20px)</Caption>
        <Heading level={5}>Crew Members</Heading>
      </div>
      <div>
        <Caption>H6 - Small Heading (16px)</Caption>
        <Heading level={6}>Details</Heading>
      </div>
    </div>
  ),
};

export const HeadingColors: StoryObj = {
  name: 'Heading Colors',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Heading level={3} color="primary">Primary Color Heading</Heading>
      <Heading level={3} color="secondary">Secondary Color Heading</Heading>
      <Heading level={3} color="accent">Accent Color Heading</Heading>
      <Heading level={3} color="success">Success Color Heading</Heading>
      <Heading level={3} color="warning">Warning Color Heading</Heading>
      <Heading level={3} color="error">Error Color Heading</Heading>
    </div>
  ),
};

// ============================================================================
// Text Stories
// ============================================================================

export const TextComponent: StoryObj = {
  name: 'Text (Body)',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
      <div>
        <Caption>Large (20px)</Caption>
        <Text size="lg">
          Large body text for introductions and important content that needs
          to stand out from regular paragraphs.
        </Text>
      </div>
      <div>
        <Caption>Base (16px)</Caption>
        <Text>
          Regular body text is the default size for most content. It uses a comfortable
          1.5 line height for optimal readability in paragraphs. This ensures that
          users can easily scan and read longer passages of text.
        </Text>
      </div>
      <div>
        <Caption>Small (14px)</Caption>
        <Text size="sm" color="secondary">
          Small text for secondary information, UI labels, and supporting content
          that doesn't need to be as prominent as the main body text.
        </Text>
      </div>
      <div>
        <Caption>Extra Small (12px)</Caption>
        <Text size="xs" color="muted">
          Extra small text for metadata, timestamps, and tertiary information.
        </Text>
      </div>
    </div>
  ),
};

export const TextWeights: StoryObj = {
  name: 'Text Weights',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <Text weight="normal">Normal weight (400) - Default body text</Text>
      <Text weight="medium">Medium weight (500) - Slight emphasis</Text>
      <Text weight="semibold">Semibold weight (600) - Strong emphasis</Text>
      <Text weight="bold">Bold weight (700) - Maximum emphasis</Text>
    </div>
  ),
};

export const TextLineHeights: StoryObj = {
  name: 'Text Line Heights',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '500px' }}>
      <div style={{ background: 'rgba(0, 217, 255, 0.1)', padding: '1rem' }}>
        <Caption>Tight (1.25)</Caption>
        <Text leading="tight">
          This text has tight line-height, suitable for short blocks of text or headings
          that need compact spacing.
        </Text>
      </div>
      <div style={{ background: 'rgba(0, 217, 255, 0.1)', padding: '1rem' }}>
        <Caption>Normal (1.5)</Caption>
        <Text leading="normal">
          This text has normal line-height. It provides comfortable reading for most
          body text and is the default setting.
        </Text>
      </div>
      <div style={{ background: 'rgba(0, 217, 255, 0.1)', padding: '1rem' }}>
        <Caption>Relaxed (1.625)</Caption>
        <Text leading="relaxed">
          This text has relaxed line-height. It's ideal for longer paragraphs where
          extra breathing room improves readability.
        </Text>
      </div>
      <div style={{ background: 'rgba(0, 217, 255, 0.1)', padding: '1rem' }}>
        <Caption>Prose (1.75)</Caption>
        <Text leading="prose">
          This text has prose line-height. It's designed for long-form content like
          articles or documentation where maximum readability is crucial.
        </Text>
      </div>
    </div>
  ),
};

// ============================================================================
// Label Stories
// ============================================================================

export const LabelComponent: StoryObj = {
  name: 'Label',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Label>Default Label</Label>
        <div style={{ background: 'var(--secondary-bg)', padding: '0.75rem', borderRadius: '4px' }}>
          <Text size="sm" color="muted">Input field placeholder</Text>
        </div>
      </div>
      <div>
        <Label required>Required Label</Label>
        <div style={{ background: 'var(--secondary-bg)', padding: '0.75rem', borderRadius: '4px' }}>
          <Text size="sm" color="muted">Required input field</Text>
        </div>
      </div>
      <div>
        <Label uppercase size="sm">Category Label</Label>
        <Text>Content under uppercase label</Text>
      </div>
    </div>
  ),
};

// ============================================================================
// Caption Stories
// ============================================================================

export const CaptionComponent: StoryObj = {
  name: 'Caption',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Caption>Last updated 3 hours ago</Caption>
        <Caption color="muted">•</Caption>
        <Caption color="muted">12 items</Caption>
      </div>
      <div>
        <Caption color="secondary">By Commander Johnson</Caption>
      </div>
      <div>
        <Caption color="accent">Online</Caption>
      </div>
      <div>
        <Caption color="success">✓ Verified</Caption>
      </div>
      <div>
        <Caption color="error">⚠ Action required</Caption>
      </div>
    </div>
  ),
};

// ============================================================================
// Code Stories
// ============================================================================

export const CodeComponent: StoryObj = {
  name: 'Code',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Caption>Inline Code</Caption>
        <Text>
          Run <Code>npm install</Code> to install dependencies, then <Code>npm start</Code> to begin.
        </Text>
      </div>
      <div>
        <Caption>Code Block</Caption>
        <Code block>
{`// Fleet configuration
const fleet = {
  name: 'Alpha Squadron',
  ships: ['Carrack', 'Hammerhead', 'Prowler'],
  status: 'active'
};`}
        </Code>
      </div>
    </div>
  ),
};

// ============================================================================
// Typography Scale Reference
// ============================================================================

export const TypographyScale: StoryObj = {
  name: 'Complete Scale Reference',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>6xl</span>
        <span style={{ fontSize: '4.5rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>Aa</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>72px • Display Large</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>5xl</span>
        <span style={{ fontSize: '3.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>Aa</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>60px • Display</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>4xl</span>
        <span style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' }}>Aa</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>48px • H1</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>3xl</span>
        <span style={{ fontSize: '2.25rem', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em' }}>Aa</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>36px • H2</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>2xl</span>
        <span style={{ fontSize: '1.875rem', fontWeight: 600, lineHeight: 1.3 }}>Aa</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>30px • H3</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>xl</span>
        <span style={{ fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3 }}>Aa</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>24px • H4</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>lg</span>
        <span style={{ fontSize: '1.25rem', fontWeight: 500, lineHeight: 1.5 }}>Aa</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>20px • Large Body / H5</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>base</span>
        <span style={{ fontSize: '1rem', fontWeight: 400, lineHeight: 1.5 }}>Aa</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>16px • Body / H6</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>sm</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 }}>Aa</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>14px • Small</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
        <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>xs</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 400, lineHeight: 1.5 }}>Aa</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>12px • Caption</span>
      </div>
    </div>
  ),
};

// ============================================================================
// Real-World Example
// ============================================================================

export const RealWorldExample: StoryObj = {
  name: 'Real-World Example',
  render: () => (
    <div style={{ 
      maxWidth: '800px', 
      background: 'var(--secondary-bg)', 
      borderRadius: '12px', 
      padding: '2rem',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Caption color="accent">ALPHA SQUADRON</Caption>
        <Display size="sm" gradient>Fleet Status Report</Display>
        <Text color="secondary" style={{ marginTop: '0.5rem' }}>
          Weekly operational summary for organization leadership
        </Text>
      </div>
      
      <Heading level={2}>Overview</Heading>
      <Text leading="relaxed">
        This week saw significant activity across all operational theaters. Mining
        operations exceeded targets by 23%, while exploration teams mapped 12 new
        jump points in the Stanton system.
      </Text>
      
      <Heading level={3} style={{ marginTop: '1.5rem' }}>Active Ships</Heading>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
        {['Carrack', 'Hammerhead', 'Prowler'].map(ship => (
          <div key={ship} style={{ background: 'var(--primary-bg)', padding: '1rem', borderRadius: '8px' }}>
            <Heading level={4} color="accent">{ship}</Heading>
            <Caption>Status: <span style={{ color: 'var(--success)' }}>Online</span></Caption>
          </div>
        ))}
      </div>
      
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
        <Caption>Generated by Fleet Management System</Caption>
        <Caption color="muted">Last updated: 3 hours ago</Caption>
      </div>
    </div>
  ),
};
