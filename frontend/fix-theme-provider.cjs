/**
 * Fix ThemeProvider is not defined errors in test files
 * 
 * These tests use <ThemeProvider theme={theme} colorScheme="dark"> without importing it.
 * Fix: Add `import { ThemeProvider, createTheme } from '@mui/material/styles';`
 *       and `const theme = createTheme();` before the describe block.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'src/components/navigation/__tests__/CommandPalette.test.tsx',
  'src/components/__tests__/OnboardingFlow.test.tsx',
  'src/components/__tests__/OrganizationDeleteConfirmationModal.test.tsx',
  'src/components/__tests__/LiveActivityFeed.test.tsx',
  'src/components/navigation/__tests__/HubSidebar.test.tsx',
  'src/components/navigation/__tests__/TopNavigation.test.tsx',
  'src/components/__tests__/NotificationBell.test.tsx',
  'src/components/__tests__/Layout.navigation.test.tsx',
  'src/components/trading/__tests__/RoutesList.test.tsx',
  'src/pages/__tests__/IntelVault.test.tsx',
  'src/components/__tests__/MiningDataDisplay.test.tsx',
  'src/components/__tests__/CustomStatusSelector.test.tsx',
  'src/components/trading/__tests__/OpportunitiesList.test.tsx',
  'src/components/__tests__/ConsentWithdrawalDialog.test.tsx',
  'src/components/__tests__/AdvancedFilterPanel.test.tsx',
  'src/pages/__tests__/IntelOfficerManagement.test.tsx',
  'src/components/__tests__/StatusQuickMenu.test.tsx',
  'src/components/__tests__/SearchFilterBar.test.tsx',
  'src/pages/__tests__/Login.test.tsx',
  'src/components/__tests__/RoutePlanner.test.tsx',
  'src/pages/__tests__/LoginOAuthCallback.test.tsx',
  'src/components/__tests__/EventDetailModal.test.tsx',
  'src/components/trading/__tests__/OpportunityFinder.test.tsx',
  'src/components/ui/__tests__/QuickActionCard.test.tsx',
  'src/components/__tests__/SessionTimeoutWarning.test.tsx',
  'src/components/__tests__/StatCard.test.tsx',
  'src/components/__tests__/ActiveFilterChips.test.tsx',
  'src/components/__tests__/TypingIndicator.test.tsx',
  'src/components/__tests__/UserProfileModal.test.tsx',
  // These files also have ThemeProvider but may also have other issues:
  'src/pages/__tests__/Trading.test.tsx',
  'src/pages/__tests__/Logistics.test.tsx',
  'src/pages/__tests__/PersonalHangar.test.tsx',
  'src/pages/__tests__/Calendar.test.tsx',
  'src/pages/__tests__/DiscordSettings.test.tsx',
  'src/components/__tests__/ActivityManagement.test.tsx',
];

let fixed = 0;
let skipped = 0;

for (const relPath of files) {
  const filePath = path.join(__dirname, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${relPath}`);
    skipped++;
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Check if ThemeProvider is already properly imported
  if (content.includes("from '@mui/material/styles'") && content.includes('ThemeProvider')) {
    console.log(`SKIP (already has import): ${relPath}`);
    skipped++;
    continue;
  }

  // Check if this file actually uses ThemeProvider
  if (!content.includes('<ThemeProvider')) {
    console.log(`SKIP (no ThemeProvider usage): ${relPath}`);
    skipped++;
    continue;
  }

  let changes = [];

  // 1. Add ThemeProvider + createTheme import
  // Find the right place: after the last import line
  const importLines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < importLines.length; i++) {
    if (importLines[i].match(/^import /)) {
      lastImportIdx = i;
    }
    // Also handle multi-line imports - find the closing line
    if (importLines[i].match(/} from ['"]/) && lastImportIdx >= 0) {
      lastImportIdx = i;
    }
  }

  if (lastImportIdx === -1) {
    console.log(`SKIP (no imports found): ${relPath}`);
    skipped++;
    continue;
  }

  // Check if there's already a `const theme = ` line
  const hasThemeConst = content.includes('const theme = ');

  // Add import after last import
  const importLine = "import { ThemeProvider, createTheme } from '@mui/material/styles';";

  // Only add if not already present
  if (!content.includes(importLine) && !content.includes("ThemeProvider")) {
    importLines.splice(lastImportIdx + 1, 0, importLine);
    changes.push('added ThemeProvider import');
  }

  // Add `const theme = createTheme();` before the first describe block if not present
  if (!hasThemeConst) {
    let insertIdx = -1;
    for (let i = 0; i < importLines.length; i++) {
      if (importLines[i].match(/^describe\(/) || importLines[i].match(/^\/\/ /) && insertIdx === -1) {
        // Look for the first non-import, non-comment line before describe
        insertIdx = i;
        break;
      }
    }

    if (insertIdx === -1) {
      // Find describe anywhere  
      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].includes('describe(')) {
          insertIdx = i;
          break;
        }
      }
    }

    if (insertIdx > 0) {
      importLines.splice(insertIdx, 0, '', 'const theme = createTheme();');
      changes.push('added theme const');
    }
  }

  if (changes.length > 0) {
    content = importLines.join('\n');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`FIXED (${changes.join(', ')}): ${relPath}`);
    fixed++;
  } else {
    console.log(`SKIP (no changes needed): ${relPath}`);
    skipped++;
  }
}

console.log(`\nDone! Fixed: ${fixed}, Skipped: ${skipped}`);
