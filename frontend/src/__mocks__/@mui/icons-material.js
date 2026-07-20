// Mock for @mui/icons-material imports
// Returns a simple React component that renders an svg element
const React = require('react');

const createMockIcon = (displayName) => {
  const MockIcon = React.forwardRef((props, ref) => (
    React.createElement('svg', { 
      'data-testid': `${displayName}Icon`, 
      ref: ref, 
      ...props 
    }, React.createElement('path', null))
  ));
  MockIcon.displayName = displayName;
  return MockIcon;
};

// Create a proxy that returns a mock icon for any property access
const iconMockHandler = {
  get: (_target, prop) => {
    if (prop === '__esModule') return true;
    if (prop === 'default') return createMockIcon('MockIcon');
    return createMockIcon(prop);
  },
};

// Export as a Proxy to handle any icon import dynamically
module.exports = new Proxy({}, iconMockHandler);
