import {
  Science as Beaker,
  ViewList as BoxList,
  CalendarToday as CalendarIcon,
  AccountTree as DataMapping,
  Public as GlobeOutline,
  IosShare as ShareAndroid,
  ShoppingCart,
  Group as UserGroup,
} from '@mui/icons-material';
import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react';
import { QuickActionCard } from './QuickActionCard';

type IconProps = { className?: string; sx?: any };

const BoxListIcon: React.FC<IconProps> = ({ className, sx }) => (
  <BoxList className={className} sx={sx} />
);

const UserGroupIcon: React.FC<IconProps> = ({ className, sx }) => (
  <UserGroup className={className} sx={sx} />
);

const ShoppingCartIcon: React.FC<IconProps> = ({ className, sx }) => (
  <ShoppingCart className={className} sx={sx} />
);

const CalendarIconComponent: React.FC<IconProps> = ({ className, sx }) => (
  <CalendarIcon className={className} sx={sx} />
);

const DataMappingIcon: React.FC<IconProps> = ({ className, sx }) => (
  <DataMapping className={className} sx={sx} />
);

const BeakerIcon: React.FC<IconProps> = ({ className, sx }) => (
  <Beaker className={className} sx={sx} />
);

const GlobeOutlineIcon: React.FC<IconProps> = ({ className, sx }) => (
  <GlobeOutline className={className} sx={sx} />
);

const ShareAndroidIcon: React.FC<IconProps> = ({ className, sx }) => (
  <ShareAndroid className={className} sx={sx} />
);
export const meta: Meta<typeof QuickActionCard> = {
  title: 'UI/QuickActionCard',
  component: QuickActionCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClick: {
      action: 'clicked',
    },
  },
};

type Story = StoryObj<typeof meta>;

export const FleetManagement: Story = {
  args: {
    title: 'Fleet Management',
    description: 'Manage your fleet and ships',
    icon: BoxListIcon,
    onClick: () => console.log('Navigate to fleet'),
  },
};

export const MemberManagement: Story = {
  args: {
    title: 'Members',
    description: 'Box and manage organization members',
    icon: UserGroupIcon,
    onClick: () => console.log('Navigate to members'),
  },
};

export const Trading: Story = {
  args: {
    title: 'Trading',
    description: 'Trade routes and market data',
    icon: ShoppingCartIcon,
    onClick: () => console.log('Navigate to trading'),
  },
};

export const CalendarStory: Story = {
  name: 'Calendar',
  args: {
    title: 'Calendar',
    description: 'Box events and schedules',
    icon: CalendarIconComponent,
    onClick: () => console.log('Navigate to calendar'),
  },
};

export const Logistics: Story = {
  args: {
    title: 'Logistics',
    description: 'Inventory and supply management',
    icon: DataMappingIcon,
    onClick: () => console.log('Navigate to logistics'),
  },
};

export const Activities: Story = {
  args: {
    title: 'Activities',
    description: 'Mining, bounties, and missions',
    icon: BeakerIcon,
    onClick: () => console.log('Navigate to activities'),
  },
};

export const DashboardGrid: Story = {
  name: 'Dashboard Grid Example',
  render: () => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        maxWidth: '900px',
      }}
    >
      <QuickActionCard
        title="Fleet Management"
        description="Manage your fleet and ships"
        icon={BoxListIcon}
        onClick={() => console.log('Navigate to fleet')}
      />
      <QuickActionCard
        title="Members"
        description="Box and manage members"
        icon={UserGroupIcon}
        onClick={() => console.log('Navigate to members')}
      />
      <QuickActionCard
        title="Trading"
        description="Trade routes and markets"
        icon={ShoppingCartIcon}
        onClick={() => console.log('Navigate to trading')}
      />
      <QuickActionCard
        title="Calendar"
        description="Events and schedules"
        icon={CalendarIconComponent}
        onClick={() => console.log('Navigate to calendar')}
      />
      <QuickActionCard
        title="Logistics"
        description="Inventory management"
        icon={DataMappingIcon}
        onClick={() => console.log('Navigate to logistics')}
      />
      <QuickActionCard
        title="Activities"
        description="Mining, bounties, missions"
        icon={BeakerIcon}
        onClick={() => console.log('Navigate to activities')}
      />
    </Box>
  ),
};

export const TwoColumnGrid: Story = {
  name: 'Two Column Layout',
  render: () => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1rem',
        maxWidth: '600px',
      }}
    >
      <QuickActionCard
        title="Organizations"
        description="Manage your organizations"
        icon={GlobeOutlineIcon}
        onClick={() => console.log('Navigate to orgs')}
      />
      <QuickActionCard
        title="Discord"
        description="Integration settings"
        icon={ShareAndroidIcon}
        onClick={() => console.log('Navigate to discord')}
      />
      <QuickActionCard
        title="Fleet"
        description="Your ship collection"
        icon={BoxListIcon}
        onClick={() => console.log('Navigate to fleet')}
      />
      <QuickActionCard
        title="Members"
        description="Team management"
        icon={UserGroupIcon}
        onClick={() => console.log('Navigate to members')}
      />
    </Box>
  ),
};

export const FourColumnGrid: Story = {
  name: 'Four Column Layout',
  render: () => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        maxWidth: '1200px',
      }}
    >
      <QuickActionCard
        title="Fleet"
        description="Manage ships"
        icon={BoxListIcon}
        onClick={() => console.log('Fleet')}
      />
      <QuickActionCard
        title="Members"
        description="Team roster"
        icon={UserGroupIcon}
        onClick={() => console.log('Members')}
      />
      <QuickActionCard
        title="Trading"
        description="Trade routes"
        icon={ShoppingCartIcon}
        onClick={() => console.log('Trading')}
      />
      <QuickActionCard
        title="Calendar"
        description="Events"
        icon={CalendarIconComponent}
        onClick={() => console.log('Calendar')}
      />
      <QuickActionCard
        title="Logistics"
        description="Inventory"
        icon={DataMappingIcon}
        onClick={() => console.log('Logistics')}
      />
      <QuickActionCard
        title="Activities"
        description="Missions"
        icon={BeakerIcon}
        onClick={() => console.log('Activities')}
      />
      <QuickActionCard
        title="Organizations"
        description="Manage orgs"
        icon={GlobeOutlineIcon}
        onClick={() => console.log('Orgs')}
      />
      <QuickActionCard
        title="Discord"
        description="Integration"
        icon={ShareAndroidIcon}
        onClick={() => console.log('Discord')}
      />
    </Box>
  ),
};

export const SingleCard: Story = {
  name: 'Single Card',
  args: {
    title: 'Settings',
    description: 'Configure your preferences',
    icon: DataMappingIcon,
    onClick: () => console.log('Navigate to settings'),
  },
};
