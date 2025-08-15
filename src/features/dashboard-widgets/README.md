# Dashboard Widgets

This directory contains the dashboard widget system for the Ever Life Vault application.

## Widget Types

Widgets are categorized into several types:
- **shortcuts**: Quick access to common actions
- **helpers**: Utility widgets for daily tasks
- **analytics**: Data visualization and insights
- **actions**: Interactive widgets that perform actions
- **other**: Miscellaneous widgets

## External API Integration

Many widgets integrate with external APIs to provide real-time data. These widgets now support configurable caching to improve performance and reduce API calls.

### Cache Configuration

Widgets that use external APIs include a cache configuration section that allows users to:

1. **Choose from preset cache times**:
   - Short (30 seconds)
   - Medium (5 minutes)
   - Long (15 minutes)
   - Very Long (1 hour)
   - No caching

2. **Set custom cache times** in seconds
3. **Clear cache** to force a refresh

### Cache Settings Visibility

Cache configuration is available in two modes:

#### **View Mode** (Normal Dashboard)
- Cache settings are **NOT visible** to keep the dashboard clean and uncluttered
- Widgets function normally with their configured cache settings
- Users can still access cache configuration by switching to edit mode

#### **Edit Mode** (Layout Editing)
- Cache settings appear below each widget in a dedicated section
- Blue "Cache" badge in widget header indicates caching support
- Current cache time is displayed in the header (e.g., "Cache (30s)")
- Each widget handles its own cache configuration display
- Perfect for bulk configuration while customizing dashboard layout

### Widgets with Cache Support

The following widgets support configurable caching and show cache settings only in edit mode:

#### Weather & Location Widgets
- **Air Quality Widget** - Default: 5 minutes
- **Precip Nowcast Widget** - Default: 2 minutes  
- **Sun Phases Widget** - Default: 1 hour
- **Wind Focus Widget** - Default: 5 minutes

#### Network & System Widgets
- **IP & Network Widget** - Default: 15 minutes
- **Jellyfin Widget** - Default: 30 seconds
- **Jellyseerr Widget** - Default: 30 seconds
- **Karakeep Widget** - Default: 30 seconds

#### Data & Utility Widgets
- **Currency Converter Widget** - Default: 15 minutes
- **Quotes Widget** - Default: 30 minutes (when using external source)

#### Gaming Widgets
- **Steam Profile Widget** - Default: 5 minutes
- **Steam Recently Played Widget** - Default: 5 minutes
- **Steam Backlog Widget** - Default: 5 minutes
- **Steam Game Detail Widget** - Default: 5 minutes

### Cache Implementation

The caching system is implemented using:

1. **useApiCache Hook**: A custom React hook that manages cache state with in-memory + IndexedDB persistence
2. **CacheConfig Component**: A reusable UI component for cache configuration
3. **BaseWidgetConfig Interface**: Extends widget configurations with cache settings

#### Example Usage

```typescript
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type MyWidgetConfig = BaseWidgetConfig & {
  // ... other config options
}

export default function MyWidget({ config, onConfigChange }: WidgetProps<MyWidgetConfig>) {
  const { getCachedAsync, setCached } = useApiCache<MyDataType>()

  const refresh = useCallback(async () => {
    // Check cache first (IndexedDB-backed)
    const cacheKey = generateCacheKey('my-widget', { param: value })
    const cached = await getCachedAsync(cacheKey, config.cacheTimeMs)
    if (cached) {
      setData(cached)
      return
    }

    // Fetch fresh data
    const data = await fetchData()
    setData(data)

    // Cache the result (persists to IndexedDB)
    setCached(cacheKey, data, config.cacheTimeMs)
  }, [config.cacheTimeMs, getCachedAsync, setCached])

  return (
    <WidgetShell title="My Widget">
      {/* Widget content */}

      {/* Cache Configuration */}
      <CacheConfig config={config} onConfigChange={onConfigChange} />
    </WidgetShell>
  )
}
```

### Cache Key Generation

Cache keys are automatically generated based on widget parameters to ensure proper cache isolation:

```typescript
// For location-based widgets
generateCacheKey('air-quality', { lat: 40.7128, lon: -74.0060 })

// For API-based widgets
generateCacheKey('jellyfin', { serverUrl: 'https://example.com' })

// For parameter-based widgets
generateCacheKey('currency-rates', { base: 'USD' })
```

### Benefits

1. **Reduced API Calls**: Minimizes external API requests
2. **Improved Performance**: Faster widget loading for cached data
3. **Better User Experience**: Consistent data display across widget refreshes
4. **Configurable**: Users can adjust cache times based on their needs
5. **Automatic Cleanup**: Expired cache entries are automatically removed
6. **Edit Mode Access**: Easy cache configuration while customizing dashboard layout
7. **Clean View Mode**: Cache settings are hidden during normal dashboard viewing for a clutter-free experience

### Best Practices

1. **Set appropriate default cache times** based on data freshness requirements
2. **Use shorter cache times** for frequently changing data (weather, system status)
3. **Use longer cache times** for relatively static data (quotes, currency rates)
4. **Consider API rate limits** when setting cache times
5. **Provide clear cache configuration UI** for users to understand the options
6. **Use edit mode** for bulk cache configuration across multiple widgets
7. **Keep view mode clean** by hiding cache settings during normal dashboard usage

## Adding New Widgets

To add a new widget with cache support:

1. Extend `BaseWidgetConfig` in your widget's config type
2. Import and use the `useApiCache` hook
3. Add the `CacheConfig` component to your widget's UI
4. Update the widget registry with `usesExternalApis: true` and appropriate `defaultCacheTimeMs`
5. Implement cache logic in your data fetching functions

## Widget Registry

Widgets are registered in `registry.tsx` with metadata including:
- Unique ID and title
- Category and version
- Default configuration
- Component import
- External API usage flags (`usesExternalApis: true`)
- Default cache time settings (`defaultCacheTimeMs`)

## Dashboard Layout Editing

When editing the dashboard layout:

1. **Toggle Edit Mode**: Use the "Edit layout" switch to enter editing mode
2. **View Cache Settings**: Cache configuration appears below widgets that use external APIs
3. **Configure Caching**: Adjust cache times for individual widgets
4. **Visual Indicators**: Blue cache badges show which widgets support caching
5. **Real-time Updates**: Changes are applied immediately and saved automatically
