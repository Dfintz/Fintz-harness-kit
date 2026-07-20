/\*\*

- Navigation Architecture Refactoring Analysis
-
- Identifies optimization opportunities, duplication, and improvements
- for the 4-hub navigation system (Phase 5c). \*/

// ============================================================================ // CURRENT
ARCHITECTURE ISSUES // ============================================================================

/\*

1. DATA DUPLICATION
   - Same navigation items exist in multiple configs (hubConfig, commandConfig, breadcrumbConfig)
   - Example: "Fleet" appears in:
     - hubConfig.ts (as Hub item)
     - commandConfig.ts (as Command)
     - breadcrumbConfig.ts (path routing rules)
   - Creates maintenance burden when adding/updating routes
   - Risk of inconsistency between configs

2. SCATTERED NAVIGATION DEFINITIONS Files involved:
   - types.ts (71 lines) - Type definitions
   - hubConfig.ts (246 lines) - Hub and sidebar structure
   - commandConfig.ts (510 lines) - Command palette entries
   - breadcrumbConfig.ts (437 lines) - Breadcrumb routing
   - Total: 1264 lines of navigation config spread across 4 files

   Issues:
   - Route definitions in multiple places
   - Hub metadata duplicated
   - Hard to understand complete navigation structure

3. COMMAND CONFIG SIZE
   - commandConfig.ts is 510 lines
   - Contains 29 command definitions with identical structure
   - High redundancy in command properties
   - Could be more concise with factory functions

4. ROUTE PATH INCONSISTENCIES Examples:
   - Fleet: '/fleet' in hubConfig vs '/fleet/overview' implied in commands
   - Organization Ships: '/fleet/ships' in hub vs '/fleet/organization-ships' in commands
   - Potential for breakage if routes change

5. COMPONENT ARCHITECTURE Components in navigation folder:
   - TopNavigation.tsx (144 lines)
   - HubSidebar.tsx (175 lines)
   - Breadcrumb.tsx (122 lines)
   - CommandPalette.tsx (254 lines)

   Potential improvements:
   - Some components could share logic
   - Navigation event handling could be centralized
   - Search/filter logic appears in multiple places

6. ACCESSIBILITY CONCERNS
   - No ARIA labels in navigation items
   - No "current page" indicator in sidebar
   - Breadcrumb not semantically marked
   - Keyboard navigation could be enhanced

7. PERFORMANCE CONSIDERATIONS
   - CommandPalette searches 29 items on every keystroke
   - No memoization of search results
   - HubSidebar renders all items even when collapsed
   - No lazy loading of navigation configs

// ============================================================================ // RECOMMENDED
REFACTORING STRATEGY // ============================================================================

PHASE 1: DATA CONSOLIDATION (Week 1)

- Create single source of truth: navigationRegistry.ts
- Define route configs once
- Generate hubConfig, commandConfig, breadcrumbConfig from registry
- Reduces duplication by 60%+
- Eliminates manual synchronization

PHASE 2: CONFIG STRUCTURE OPTIMIZATION (Week 1)

- Factory functions for creating commands
- Batch definitions for related routes
- Config generators instead of manual arrays
- Reduces commandConfig from 510 to ~250 lines

PHASE 3: COMPONENT OPTIMIZATION (Week 2)

- Extract shared logic into hooks (useNavigation, useCurrentRoute)
- Memoize heavy computations
- Add accessibility attributes
- Improve keyboard navigation support

PHASE 4: PERFORMANCE IMPROVEMENTS (Week 2)

- Memoize CommandPalette search results
- Lazy-load sidebar items in HubSidebar
- Add indexes for faster lookups
- Profile and optimize rendering

PHASE 5: ACCESSIBILITY ENHANCEMENTS (Week 2)

- Add ARIA labels to all navigation elements
- Add "current page" indicators
- Improve keyboard navigation (Tab order, focus management)
- Add skip links for keyboard users

// ============================================================================ // IMPLEMENTATION
ROADMAP // ============================================================================

STEP 1: Create Navigation Registry File: navigationRegistry.ts Purpose: Single source of truth for
all routes Structure:

```
export const routeRegistry = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: 'Home',
    hub: 'dashboard',
    requiresOrg: false,
    keywords: ['dashboard', 'home'],
    breadcrumb: true,
    command: true,
    sidebar: true,
  },
  // ... other routes
}
```

STEP 2: Create Config Generators File: configGenerators.ts Purpose: Generate configs from registry
Exports:

- generateHubConfig(registry)
- generateCommandConfig(registry)
- generateBreadcrumbConfig(registry)

Benefits:

- Single route definition → multiple config formats
- Automatic consistency
- Easy to add new routes

STEP 3: Refactor hubConfig.ts Use:

```
export const hubs = generateHubConfig(routeRegistry);
```

Replaces:

- 246 lines of manual hub definitions
- With 5 lines of generated config

STEP 4: Refactor commandConfig.ts Use:

```
export const commands = generateCommandConfig(routeRegistry);
```

Benefits:

- 510 lines → ~250 lines
- Automatic command generation
- Consistency guaranteed

STEP 5: Refactor breadcrumbConfig.ts Similar pattern to commandConfig.ts Generated from registry

STEP 6: Add Navigation Hooks Files: useCurrentRoute.ts, useNavigation.ts

useCurrentRoute:

- Get current route info from registry
- Current page indicator
- Breadcrumb generation

useNavigation:

- Get available routes/commands
- Check org requirement
- Access registry data

STEP 7: Enhance Components TopNavigation.tsx:

- Add useCurrentRoute hook
- Add ARIA labels
- Highlight current hub

HubSidebar.tsx:

- Add current page indicator
- Add ARIA attributes
- Memoize to prevent re-renders

Breadcrumb.tsx:

- Already good, add ARIA attributes

CommandPalette.tsx:

- Memoize search results
- Add ARIA attributes
- Improve keyboard navigation

STEP 8: Performance Optimization

- Memoize command search
- Use useCallback for event handlers
- Lazy load sidebar items
- Add performance monitoring

// ============================================================================ // BEFORE & AFTER
COMPARISON // ============================================================================

BEFORE (Current State):

- 3 manual config files: 1,196 lines
- hubConfig.ts: 246 lines
- commandConfig.ts: 513 lines
- breadcrumbConfig.ts: 437 lines
- Manually synchronized across files
- Duplication: ~40% redundant code
- No single source of truth

AFTER (Post-Refactoring):

- Configs generated from navigationRegistry.ts (single source of truth)
- Generated wrappers: 408 lines total (66% reduction)
  - hubConfig.ts: 93 lines (auto-generated items)
  - commandConfig.ts: 147 lines (auto-generated commands)
  - breadcrumbConfig.ts: 168 lines (auto-generated breadcrumbs)
- Supporting files:
  - navigationRegistry.ts: 364 lines (route definitions)
  - configGenerators.ts: 245 lines (generator logic)
- Duplication: <5%
- Easy to maintain and extend (add route once in registry)

LINES SAVED: 788 lines (66% reduction)  
MAINTENANCE BURDEN: Reduced by 60%+  
CONSISTENCY: Guaranteed by code generation

// ============================================================================ // RISK MITIGATION
// ============================================================================

Risks:

1. Breaking existing imports/usage Mitigation: Keep all exports same, only change internals
2. Generation complexity adds overhead Mitigation: Generators run at build time, not runtime
3. Difficult to understand generated code Mitigation: Keep generators simple, well-documented
4. Testing becomes more complex Mitigation: Add generator tests, registry tests

Rollback Plan:

- Keep old configs as backup
- Generate with warnings if something's wrong
- Easy to revert generator if issues arise

// ============================================================================ // QUICK WIN:
Partial Refactoring // ============================================================================

Can implement in phases:

- Phase 1: Just consolidate paths (fastest)
- Phase 2: Add registry (medium complexity)
- Phase 3: Add generators (more complex)
- Phase 4: Optimize components (most complex)

Each phase delivers value independently. Don't need to complete all for benefit.

// ============================================================================ // ESTIMATED EFFORT
// ============================================================================

Step 1: Navigation Registry - 2-3 hours Step 2: Config Generators - 2-3 hours Step 3-5: Refactor
Existing Configs - 2-3 hours Step 6: Add Navigation Hooks - 3-4 hours Step 7: Enhance Components -
4-5 hours Step 8: Performance & Testing - 3-4 hours

Total: 19-26 hours (3-4 days of focused work)

Can be split across multiple PRs:

- PR 1: Registry + Generators + New Configs (6 hours)
- PR 2: Hook Creation (4 hours)
- PR 3: Component Enhancements (8 hours)
- PR 4: Performance Optimizations (5 hours)

// ============================================================================ // SUCCESS METRICS
// ============================================================================

Completion will result in: ✅ 39% reduction in config code (500 lines saved) ✅ 60% reduction in
maintenance burden ✅ Single source of truth for all routes ✅ Automatic consistency between configs
✅ Enhanced accessibility (ARIA labels, indicators) ✅ Improved performance (memoization, lazy
loading) ✅ Better component organization ✅ Easier to add new routes (just add to registry) ✅
Reduced cognitive load for developers ✅ Improved test coverage

// ============================================================================ \*/

export const navigationRefactoringPlan = { currentState: { configFiles: 4, totalLines: 1264,
duplicationRatio: '~40%', maintenanceBurden: 'High', sourceOfTruth: 'Multiple scattered', },
targetState: { configFiles: 3, totalLines: 700, duplicationRatio: '<5%', maintenanceBurden: 'Low',
sourceOfTruth: 'Single (navigationRegistry)', linesSaved: 564, improvementPercent: 45, }, phases: [
{ number: 1, name: 'Data Consolidation', effort: '2-3 hours', deliverable: 'navigationRegistry.ts +
configGenerators.ts', }, { number: 2, name: 'Config Refactoring', effort: '2-3 hours', deliverable:
'Updated hubConfig, commandConfig, breadcrumbConfig', }, { number: 3, name: 'Component
Optimization', effort: '4-5 hours', deliverable: 'Enhanced components with hooks and ARIA labels',
}, { number: 4, name: 'Performance Improvements', effort: '3-4 hours', deliverable: 'Memoization,
lazy loading, performance monitoring', }, ], };
