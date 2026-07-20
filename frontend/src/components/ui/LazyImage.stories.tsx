/**
 * LazyImage Stories - Storybook documentation for LazyImage component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Box, Stack } from '@mui/material';
import { LazyImage } from './LazyImage';

export const meta: Meta<typeof LazyImage> = {
  title: 'UI/LazyImage',
  component: LazyImage,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
LazyImage provides native lazy loading for images with a smooth loading experience.

## Features
- Native \`loading="lazy"\` attribute for browser-optimized loading
- \`decoding="async"\` for non-blocking image decode
- Skeleton placeholder during load
- Graceful error state with fallback
- Fade-in transition on load

## Usage
\`\`\`tsx

<LazyImage
  src="/images/ship.jpg"
  alt="Aurora MR"
  width={200}
  height={150}
  objectFit="cover"
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    src: {
      description: 'Image source URL',
      control: 'text',
    },
    alt: {
      description: 'Alt text for accessibility',
      control: 'text',
    },
    width: {
      description: 'Image width',
      control: 'text',
    },
    height: {
      description: 'Image height',
      control: 'text',
    },
    objectFit: {
      description: 'CSS object-fit property',
      control: 'select',
      options: ['contain', 'cover', 'fill', 'none', 'scale-down'],
    },
    borderRadius: {
      description: 'Border radius',
      control: 'text',
    },
    showSkeleton: {
      description: 'Show skeleton placeholder while loading',
      control: 'boolean',
    },
  },
};

type Story = StoryObj<typeof LazyImage>;

// Sample image URLs for stories
const sampleImages = {
  ship: 'https://picsum.photos/400/300',
  avatar: 'https://picsum.photos/100/100',
  banner: 'https://picsum.photos/800/200',
  invalid: 'https://invalid-url.test/image.jpg',
};

export const Default: Story = {
  args: {
    src: sampleImages.ship,
    alt: 'Sample spaceship image',
    width: 400,
    height: 300,
  },
};

export const WithCover: Story = {
  args: {
    src: sampleImages.ship,
    alt: 'Cover fit image',
    width: 300,
    height: 200,
    objectFit: 'cover',
    borderRadius: 8,
  },
};

export const WithContain: Story = {
  args: {
    src: sampleImages.ship,
    alt: 'Contain fit image',
    width: 300,
    height: 200,
    objectFit: 'contain',
    borderRadius: 8,
  },
  parameters: {
    docs: {
      description: {
        story: 'Using `objectFit="contain"` ensures the entire image is visible.',
      },
    },
  },
};

export const CircularAvatar: Story = {
  args: {
    src: sampleImages.avatar,
    alt: 'User avatar',
    width: 80,
    height: 80,
    objectFit: 'cover',
    borderRadius: '50%',
  },
  parameters: {
    docs: {
      description: {
        story: 'Create circular avatars by setting `borderRadius="50%"`.',
      },
    },
  },
};

export const WithoutSkeleton: Story = {
  args: {
    src: sampleImages.ship,
    alt: 'No skeleton placeholder',
    width: 300,
    height: 200,
    showSkeleton: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Disable skeleton placeholder with `showSkeleton={false}`.',
      },
    },
  },
};

export const ErrorState: Story = {
  args: {
    src: sampleImages.invalid,
    alt: 'Invalid image',
    width: 300,
    height: 200,
  },
  parameters: {
    docs: {
      description: {
        story: 'When an image fails to load, a fallback state is shown.',
      },
    },
  },
};

export const CustomFallback: Story = {
  args: {
    src: sampleImages.invalid,
    alt: 'Invalid image with custom fallback',
    width: 300,
    height: 200,
    fallback: (
      <Box
        sx={{
          width: 300,
          height: 200,
          backgroundColor: '#1a2942',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 2,
          border: '1px dashed #00d9ff',
        }}
      >
        <span style={{ color: '#00d9ff' }}>Custom Fallback</span>
      </Box>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Provide a custom fallback element for error states.',
      },
    },
  },
};

export const ResponsiveSizes: Story = {
  render: () => (
    <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center">
      <LazyImage
        src={`${sampleImages.avatar}?random=1`}
        alt="Small"
        width={60}
        height={60}
        objectFit="cover"
        borderRadius={4}
      />
      <LazyImage
        src={`${sampleImages.avatar}?random=2`}
        alt="Medium"
        width={100}
        height={100}
        objectFit="cover"
        borderRadius={8}
      />
      <LazyImage
        src={`${sampleImages.avatar}?random=3`}
        alt="Large"
        width={150}
        height={150}
        objectFit="cover"
        borderRadius={12}
      />
    </Stack>
  ),
  parameters: {
    docs: {
      description: {
        story: 'LazyImage supports various sizes for different use cases.',
      },
    },
  },
};

export const BannerImage: Story = {
  args: {
    src: sampleImages.banner,
    alt: 'Organization banner',
    width: '100%',
    height: 150,
    objectFit: 'cover',
    borderRadius: 8,
  },
  parameters: {
    docs: {
      description: {
        story: 'Use percentage widths for responsive banner images.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Box sx={{ width: 600 }}>
        <Story />
      </Box>
    ),
  ],
};
