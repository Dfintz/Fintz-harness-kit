/**
 * Typography Component Tests
 */

import { Caption, Code, Display, Heading, Label, Text } from '@/components/ui/Typography';
import { render, screen } from '@testing-library/react';

describe('Typography Components', () => {
  describe('Display', () => {
    it('renders with default props', () => {
      render(<Display testId="display">Hero Text</Display>);
      const element = screen.getByTestId('display');
      expect(element).toBeInTheDocument();
      expect(element.tagName).toBe('H1');
      expect(element).toHaveTextContent('Hero Text');
    });

    it('renders with gradient', () => {
      render(
        <Display gradient testId="gradient">
          Gradient Text
        </Display>
      );
      const element = screen.getByTestId('gradient');
      expect(element.style.background).toContain('linear-gradient');
    });

    it('renders with custom tag', () => {
      render(
        <Display as="div" testId="custom">
          Custom Tag
        </Display>
      );
      const element = screen.getByTestId('custom');
      expect(element.tagName).toBe('DIV');
    });
  });

  describe('Heading', () => {
    it('renders with correct heading level', () => {
      render(
        <Heading level={2} testId="h2">
          Section Title
        </Heading>
      );
      const element = screen.getByTestId('h2');
      expect(element.tagName).toBe('H2');
    });

    it('renders all heading levels', () => {
      const levels = [1, 2, 3, 4, 5, 6] as const;
      levels.forEach(level => {
        render(
          <Heading level={level} testId={`h${level}`}>
            Heading {level}
          </Heading>
        );
        const element = screen.getByTestId(`h${level}`);
        expect(element.tagName).toBe(`H${level}`);
      });
    });

    it('applies visual level override', () => {
      render(
        <Heading level={2} visualLevel={1} testId="visual">
          Looks like H1, semantically H2
        </Heading>
      );
      const element = screen.getByTestId('visual');
      expect(element.tagName).toBe('H2'); // Semantic tag is H2
      // Visual style would match H1 (tested via style)
    });
  });

  describe('Text', () => {
    it('renders with default props', () => {
      render(<Text testId="text">Body text</Text>);
      const element = screen.getByTestId('text');
      expect(element.tagName).toBe('P');
      expect(element).toHaveTextContent('Body text');
    });

    it('renders with custom size', () => {
      render(
        <Text size="sm" testId="small">
          Small text
        </Text>
      );
      const element = screen.getByTestId('small');
      expect(element.style.fontSize).toBe('0.875rem');
    });

    it('renders with custom weight', () => {
      render(
        <Text weight="bold" testId="bold">
          Bold text
        </Text>
      );
      const element = screen.getByTestId('bold');
      expect(element.style.fontWeight).toBe('700');
    });

    it('renders as span', () => {
      render(
        <Text as="span" testId="span">
          Span text
        </Text>
      );
      const element = screen.getByTestId('span');
      expect(element.tagName).toBe('SPAN');
    });
  });

  describe('Label', () => {
    it('renders with htmlFor attribute', () => {
      render(
        <Label htmlFor="email" testId="label">
          Email
        </Label>
      );
      const element = screen.getByTestId('label');
      expect(element).toHaveAttribute('for', 'email');
    });

    it('renders required indicator', () => {
      render(
        <Label required testId="required">
          Required Field
        </Label>
      );
      const element = screen.getByTestId('required');
      expect(element).toHaveTextContent('*');
    });

    it('renders uppercase style', () => {
      render(
        <Label uppercase testId="uppercase">
          Category
        </Label>
      );
      const element = screen.getByTestId('uppercase');
      expect(element.style.textTransform).toBe('uppercase');
    });
  });

  describe('Caption', () => {
    it('renders with default props', () => {
      render(<Caption testId="caption">Metadata</Caption>);
      const element = screen.getByTestId('caption');
      expect(element.tagName).toBe('SPAN');
      expect(element.style.fontSize).toBe('0.75rem');
    });

    it('renders as paragraph', () => {
      render(
        <Caption as="p" testId="p-caption">
          Paragraph caption
        </Caption>
      );
      const element = screen.getByTestId('p-caption');
      expect(element.tagName).toBe('P');
    });
  });

  describe('Code', () => {
    it('renders inline code', () => {
      render(<Code testId="inline">const x = 1;</Code>);
      const element = screen.getByTestId('inline');
      expect(element.tagName).toBe('CODE');
    });

    it('renders block code', () => {
      render(
        <Code block testId="block">
          function test() {}
        </Code>
      );
      const element = screen.getByTestId('block');
      expect(element.tagName).toBe('PRE');
    });
  });

  describe('Color variants', () => {
    const colors = [
      'primary',
      'secondary',
      'muted',
      'accent',
      'success',
      'warning',
      'error',
    ] as const;

    colors.forEach(color => {
      it(`renders ${color} color`, () => {
        render(
          <Text color={color} testId={`color-${color}`}>
            {color} text
          </Text>
        );
        const element = screen.getByTestId(`color-${color}`);
        expect(element.style.color).toBeTruthy();
      });
    });
  });

  describe('Text alignment', () => {
    const aligns = ['left', 'center', 'right'] as const;

    aligns.forEach(align => {
      it(`aligns text ${align}`, () => {
        render(
          <Text align={align} testId={`align-${align}`}>
            {align} aligned
          </Text>
        );
        const element = screen.getByTestId(`align-${align}`);
        expect(element.style.textAlign).toBe(align);
      });
    });
  });

  describe('Text truncation', () => {
    it('truncates single line text', () => {
      render(
        <Text truncate testId="truncate">
          Very long text that should be truncated
        </Text>
      );
      const element = screen.getByTestId('truncate');
      expect(element.style.overflow).toBe('hidden');
      expect(element.style.textOverflow).toBe('ellipsis');
    });

    it('truncates multi-line text', () => {
      render(
        <Text truncate maxLines={3} testId="multiline">
          Multi-line text that should be truncated after 3 lines
        </Text>
      );
      const element = screen.getByTestId('multiline');
      expect(element.style.display).toBe('-webkit-box');
      expect(element.style.webkitLineClamp).toBe('3');
    });
  });
});
