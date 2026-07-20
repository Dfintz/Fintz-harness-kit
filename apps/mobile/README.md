# SC Fleet Manager - Mobile App

React Native mobile application for the Star Citizen Fleet Manager platform.

## Overview

This mobile app extends the SC Fleet Manager platform to Android devices, providing fleet
management capabilities on the go.

## Features

- **Authentication**: Login and registration screens
- **Fleet Overview**: View fleet stats, performance metrics, and top performers at a glance
- **Member Management**: Browse fleet members with online/offline status
- **Notifications**: Stay updated with fleet alerts and mission updates

## Technology Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation (Native Stack & Bottom Tabs)
- **State Management**: Zustand
- **TypeScript**: Full type safety
- **Shared Types**: Integration with @sc-fleet-manager/shared-types

## Getting Started

### Prerequisites

- Node.js 20+ (Node 22 recommended for full compatibility)
- npm 10+
- Android Emulator

### Installation

From the repository root:

```bash
npm install
```

Or from the mobile app directory:

```bash
cd apps/mobile
npm install
```

### Running the App

#### Start Development Server

```bash
cd apps/mobile
npm start
```

#### Run on Android Emulator

```bash
npm run android
```

#### Run in Web Browser (for testing)

```bash
npm run web
```

### Using Expo Go

1. Install Expo Go on your mobile device:
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Start the development server:

   ```bash
   npm start
   ```

3. Scan the QR code with:
   - Android: Expo Go app

## Project Structure

```
apps/mobile/
├── assets/              # App icons and splash screens
├── src/
│   ├── components/      # Reusable UI components
│   ├── navigation/      # Navigation configuration
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   ├── screens/         # Screen components
│   │   ├── auth/        # Authentication screens
│   │   └── main/        # Main app screens
│   ├── services/        # API services
│   ├── store/           # Zustand stores
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── App.tsx              # Root component
├── app.json             # Expo configuration
├── package.json         # Dependencies
└── tsconfig.json        # TypeScript configuration
```

## Available Scripts

- `npm start` - Start the Expo development server
- `npm run dev` - Start with dev client
- `npm run android` - Run on Android emulator
- `npm run web` - Run in web browser
- `npm run build` - Type check the application
- `npm test` - Run Jest tests
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler checks
- `npm run clean` - Clean build artifacts and node_modules

## Configuration

### App Configuration (app.json)

The `app.json` file contains Expo-specific configuration:

- **App Name**: SC Fleet Manager
- **Bundle Identifiers**:
  - Android: `com.scfleetmanager.mobile`
- **Splash Screen**: Blue background (#0066CC)
- **Icons**: Located in `./assets/`

### API Configuration

The API URL is configured in `app.json` under `extra.apiUrl`. For different environments:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "http://localhost:3001/api"
    }
  }
}
```

Access in code:

```typescript
import Constants from 'expo-constants';
const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```

## Development Guidelines

### State Management

This app uses Zustand for state management. Example:

```typescript
import { useAuthStore } from '../store/authStore';

const { user, login, logout } = useAuthStore();
```

### Navigation

The app uses React Navigation with type-safe navigation:

```typescript
import type { AuthStackScreenProps } from '../navigation/types';

export const LoginScreen: React.FC<AuthStackScreenProps<'Login'>> = ({ navigation }) => {
  navigation.navigate('Register');
};
```

### Styling

Use React Native StyleSheet for component styling:

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
});
```

### API Integration

API services should be created in `src/services/`:

```typescript
// src/services/api.ts
import axios from 'axios';
import Constants from 'expo-constants';

const api = axios.create({
  baseURL: Constants.expoConfig?.extra?.apiUrl,
});

export default api;
```

## Testing

### Unit Tests

Run Jest tests:

```bash
npm test
```

### Testing on Devices

1. **Android Emulator**: Requires Android Studio
2. **Physical Devices**: Use Expo Go app

## Building for Production

### Android

```bash
expo build:android
```

Requirements:

- Google Play Developer account
- Android keystore

## Troubleshooting

### Metro Bundler Issues

Clear cache and restart:

```bash
npx expo start -c
```

### Module Resolution Issues

Rebuild node_modules:

```bash
rm -rf node_modules
npm install
```

### Type Errors with Shared Types

Rebuild shared types package:

```bash
cd ../../packages/shared-types
npm run build
```

## Future Enhancements

- [ ] Offline support with AsyncStorage
- [ ] Push notifications
- [ ] Biometric authentication
- [ ] Deep linking
- [ ] Ship loadout builder
- [ ] Mission planning
- [ ] Dark mode support

## Related Packages

- `@sc-fleet-manager/shared-types` - Shared TypeScript types
- Backend API - REST and GraphQL endpoints
- Frontend Web App - React web application

## Contributing

Please see the root [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

This project is part of the SC Fleet Manager monorepo. See the root LICENSE file for details.
