# Storybook Documentation

This directory contains the Storybook setup for the Star Citizen Fleet Manager design system.

> **📚 Complete Documentation**: See [docs/STORYBOOK.md](../../docs/STORYBOOK.md) for full implementation details.

## 🚀 Quick Start

### Run Storybook Locally
```bash
cd frontend
npm run storybook
```

Storybook will start at http://localhost:6006

### Build Static Storybook
```bash
npm run build-storybook
```

The static build will be output to `frontend/storybook-static/`

## 📦 What's Included

### Component Stories (36+ components)

#### Core UI Components
- **Button** - All variants, sizes, and states
- **Input** - Text input with validation
- **Select** - Dropdown with search
- **Card** - Content containers
- **Modal** - Dialog overlays
- **Table** - Data tables with sorting/pagination

#### Glass Components
- **GlassButton** - Translucent buttons
- **GlassCard** - Glass-styled cards
- **GlassModal** - Glass-styled modals
- **GlassPanel** - Large glass panels

#### Data Visualization
- **StatCard** - Metrics display
- **Sparkline** - Trend charts
- **TrendIndicator** - Trend direction
- **PeriodComparison** - Period comparisons

#### Utility Components
- **EmptyState** - Empty states
- **LoadingSpinner** - Loading indicators
- **Toast** - Notifications
- **Typography** - Text styling
- **Skeleton** - Loading placeholders
- **HelpTooltip** - Contextual help
- **Well** - Content grouping containers
- **LazyImage** - Lazy loading images
- **IconButton** - Icon-only buttons
- **SearchField** - Search input with clear

#### Form Components

- **Form** - Standardized form wrapper
- **FormField** - Form input with validation

#### Navigation
- **Breadcrumbs** - Navigation breadcrumbs
- **QuickActionCard** - Dashboard cards

#### Accessibility
- **FocusTrap** - Focus management
- **LiveRegion** - Screen reader announcements
- **SkipLink** - Skip to content
- **VisuallyHidden** - Screen reader only

### Design System Documentation
- **Introduction** - Overview and getting started
- **Color Guide** - Complete color palette with accessibility
- **Typography Guide** - Typography system and guidelines

## 📚 Using Storybook

### Interactive Props Controls
All components include interactive controls in the "Controls" tab. You can:
- Change prop values in real-time
- Test different component states
- Copy code examples
- View component documentation

### Viewing Documentation
Click the "Docs" tab on any component to see:
- Component overview
- Prop tables with types
- Usage examples
- Accessibility notes

### Searching
Use the search bar in the sidebar to quickly find components.

### Color Scheme Toggle
Use the toolbar to switch between light and dark color schemes (though this app is primarily dark-themed).

## 🎨 Design System

### Color Palette
- Dark theme with cyan (#00d9ff) and purple (#a855f7) accents
- WCAG 2.1 AA compliant contrast ratios
- Glass morphism effects for depth

### Typography
- System font stack for performance
- Modular scale (12px - 32px)
- Responsive sizing

### Spacing
- Adobe Spectrum spacing scale
- Consistent 8px grid system

## 🛠️ Development

### Adding New Components

1. **Create the component** in `frontend/src/components/ui/`
2. **Add JSDoc documentation** with @example tags
3. **Create a story file** `ComponentName.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ComponentName } from './ComponentName';

const meta: Meta<typeof ComponentName> = {
  title: 'UI/ComponentName',
  component: ComponentName,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Default props
  },
};
```

4. **Add multiple stories** for different states and variants
5. **Test in Storybook** - run `npm run storybook` to verify

### Story Patterns

#### Interactive Example
```tsx
export const WithState: Story = {
  render: function Component() {
    const [value, setValue] = useState('');
    return <Input value={value} onChange={setValue} />;
  },
};
```

#### Multiple Variants
```tsx
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};
```

### Addon Configuration

Current addons:
- **@storybook/addon-essentials** - Core functionality
- **@storybook/addon-interactions** - Interaction testing
- **@storybook/addon-a11y** - Accessibility testing
- **@storybook/addon-onboarding** - First-time user guide

## ♿ Accessibility

All components are tested for:

- ✅ WCAG 2.1 AA compliance
- ✅ Keyboard navigation
- ✅ Screen reader compatibility
- ✅ Focus management
- ✅ Color contrast

### Testing Tools

1. **Storybook A11y Addon** - Visual accessibility panel in Storybook
2. **jest-axe** - Automated accessibility testing in Jest

### Run Accessibility Tests

```bash
npm run test:a11y
```

This runs all tests matching `accessibility` pattern, including:

- `src/components/ui/__tests__/accessibility.test.tsx` - UI component a11y tests
- `src/components/ui/accessibility/__tests__/` - Accessibility utility tests
- `src/utils/__tests__/accessibility.test.ts` - Utility function tests

## 📝 Best Practices

### Story Naming
- Use descriptive names: `Default`, `WithError`, `Loading`
- Group related stories: `AllVariants`, `AllSizes`
- Use the `name` property for display names

### Documentation
- Add descriptions to argTypes
- Include usage examples in JSDoc
- Document edge cases and accessibility

### Organization
- Group components by category in `title`
- Use consistent file structure
- Keep stories focused and simple

## 🔧 Configuration

### Main Configuration
`.storybook/main.ts` - Storybook configuration
- Story locations
- Addons
- Framework settings
- TypeScript config

### Preview Configuration  
`.storybook/preview.ts` - Global decorators and parameters
- Adobe Spectrum Provider wrapper
- Color scheme toggle
- Default layout settings

## 🚢 Deployment

### Static Build
The static Storybook can be deployed to any static hosting:

```bash
npm run build-storybook
# Upload storybook-static/ to your hosting
```

### Vercel/Netlify
Add build command: `cd frontend && npm run build-storybook`
Output directory: `frontend/storybook-static`

### GitHub Pages
Configure GitHub Actions to build and deploy on push.

## 📖 Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Adobe React Spectrum](https://react-spectrum.adobe.com/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## 🤝 Contributing

When adding or updating components:
1. Follow existing patterns
2. Include comprehensive stories
3. Add accessibility notes
4. Test with keyboard and screen readers
5. Verify color contrast
6. Update this README if needed

---

**Questions?** Check the [main project README](../../README.md) or open an issue.
