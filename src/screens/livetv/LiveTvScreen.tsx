/**
 * Live TV — the channel browser.
 *
 * ── STRUCTURE ───────────────────────────────────────────────────────────
 * Three axes over one catalogue, because viewers look for a channel in three
 * different ways and any one of them alone leaves the others stranded:
 *
 *   Categories   genre tiles (`News`, `Sports`, `Movies`) with channel counts
 *   Countries    the same channels by country, taken from each `tvg-id`
 *   Favourites   what the viewer starred, plus what they watched last
 *
 * Search cuts across all three. Selecting a category or country drills into a
 * grid of channels; tapping a channel goes straight to the player.
 *
 * ── WHY A TAP GOES STRAIGHT TO THE PLAYER ───────────────────────────────
 * A live channel has no detail page to open — there is no synopsis, no season
 * list, no cast. So a tap is a play, and the stream is passed to the player as
 * a direct URL rather than being resolved through the backend: these are
 * already-final playlist URLs, not titles to look up.
 *
 * The request headers the playlist specifies travel with the channel. Hundreds
 * of public streams serve segments only to a matching User-Agent, so dropping
 * them is the difference between a channel that plays and one that 403s.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useLiveTvStore } from '../../store/liveTvStore';
import {
  useLiveTvCatalog,
  useCategoryChannels,
  useCountryChannels,
  useChannelSearch,
  useChannelPreload,
} from '../../hooks/useLiveTv';
import { LiveCategoryCard } from '../../components/livetv/LiveCategoryCard';
import { LiveChannelCard } from '../../components/livetv/LiveChannelCard';
import type { LiveChannel, LiveCountry, LiveCategoryInfo } from '../../services/iptv/iptvCatalog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GUTTER = 12;
const CATEGORY_COLUMNS = 3;
const CHANNEL_COLUMNS = 3;

const categoryCardWidth = (SCREEN_WIDTH - GUTTER * (CATEGORY_COLUMNS + 1)) / CATEGORY_COLUMNS;
const channelCardWidth = (SCREEN_WIDTH - GUTTER * (CHANNEL_COLUMNS + 1)) / CHANNEL_COLUMNS;

/** The three top-level axes. */
type Section = 'categories' | 'countries' | 'favourites';

/** What the channel grid is showing, or null for a top-level grid. */
type Drilldown =
  | { kind: 'category'; category: LiveCategoryInfo }
  | { kind: 'country'; country: LiveCountry }
  | null;

const LiveTvScreen = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { catalog, isLoading, isRefreshing, error, refresh } = useLiveTvCatalog();
  const preload = useChannelPreload();

  const [section, setSection] = useState<Section>('categories');
  const [drilldown, setDrilldown] = useState<Drilldown>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  /**
   * FlatList requires `onViewableItemsChanged` and `viewabilityConfig` to be
   * referentially stable — swapping either after mount throws. So they are held
   * in refs, and the callback reaches the current `preload` through a ref rather
   * than closing over it.
   */
  const preloadRef = useRef<(channels: LiveChannel[]) => void>(() => {});
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: any }> }) => {
      const onScreen = viewableItems
        .map((entry) => entry.item as LiveChannel)
        .filter((item) => item && typeof item.url === 'string');
      if (onScreen.length > 0) preloadRef.current(onScreen.slice(0, 6));
    }
  ).current;

  // Keep the stable viewability callback pointing at the current preload.
  React.useEffect(() => {
    preloadRef.current = preload;
  }, [preload]);

  const favourites = useLiveTvStore((state) => state.favourites);
  const recents = useLiveTvStore((state) => state.recents);
  const toggleFavourite = useLiveTvStore((state) => state.toggleFavourite);
  const recordRecent = useLiveTvStore((state) => state.recordRecent);
  const clearRecents = useLiveTvStore((state) => state.clearRecents);

  const favouriteIds = useMemo(
    () => new Set(favourites.map((channel) => channel.id)),
    [favourites]
  );

  const categoryChannels = useCategoryChannels(
    catalog,
    drilldown?.kind === 'category' ? drilldown.category.id : null
  );
  const countryChannels = useCountryChannels(
    catalog,
    drilldown?.kind === 'country' ? drilldown.country.code : null
  );
  const searchResults = useChannelSearch(catalog, query);

  const searching = searchOpen && query.trim().length > 0;

  /**
   * The channels the grid is showing.
   *
   * Favourites and recents hold their own copies (they are persisted, so they
   * must survive a catalogue that no longer lists the channel), which is why
   * they are not derived from the catalogue here.
   */
  const visibleChannels: LiveChannel[] = useMemo(() => {
    if (searching) return searchResults;
    if (drilldown?.kind === 'category') return categoryChannels;
    if (drilldown?.kind === 'country') return countryChannels;
    return [];
  }, [searching, searchResults, drilldown, categoryChannels, countryChannels]);

  /**
   * Warm the streams for what the viewer is looking at.
   *
   * Live HLS starts with a small manifest at the same host as the segments, so
   * fetching it early resolves DNS, finishes the TLS handshake and gets the CDN
   * serving from a warm path — the work that otherwise happens in front of the
   * viewer on tap. Only the first screenful is warmed; anything deeper is not
   * about to be tapped.
   */
  const warmedRef = useRef(false);
  const warmFirstScreen = useCallback(
    (channels: LiveChannel[]) => {
      if (warmedRef.current || channels.length === 0) return;
      warmedRef.current = true;
      preload(channels.slice(0, 12));
    },
    [preload]
  );

  // Reset the warm-up guard when the list changes, so each new grid warms its
  // own first screenful rather than being suppressed by the previous one.
  React.useEffect(() => {
    warmedRef.current = false;
  }, [drilldown, searching, section]);

  const openChannel = useCallback(
    (channel: LiveChannel) => {
      recordRecent(channel);
      router.push({
        pathname: '/player',
        params: {
          // Live has no TMDB identity. `movie` is the safe shape: the player
          // skips watch-progress entirely when `isLive` is set, so nothing is
          // recorded as a resumable title, and it has no episode to look for.
          mediaId: channel.id,
          mediaType: 'movie',
          title: channel.name,
          poster_path: channel.logo || '',
          isLive: 'true',
          streamUrl: channel.url,
          streamHeaders: channel.headers ? JSON.stringify(channel.headers) : '',
        },
      });
    },
    [recordRecent]
  );

  const handleToggleFavourite = useCallback(
    (channel: LiveChannel) => toggleFavourite(channel),
    [toggleFavourite]
  );

  const cardLabels = useMemo(
    () => ({
      geoBlocked: t('livetv.geoBlocked'),
      partTime: t('livetv.partTime'),
    }),
    [t]
  );

  // ─── Channel grid ───
  const renderChannel = useCallback(
    ({ item }: { item: LiveChannel }) => (
      <LiveChannelCard
        channel={item}
        onPress={openChannel}
        onLongPress={handleToggleFavourite}
        isFavourite={favouriteIds.has(item.id)}
        width={channelCardWidth}
        height={channelCardWidth * 0.92}
        labels={cardLabels}
      />
    ),
    [openChannel, handleToggleFavourite, favouriteIds, cardLabels]
  );

  // ─── Category grid ───
  const renderCategory = useCallback(
    ({ item }: { item: LiveCategoryInfo }) => (
      <LiveCategoryCard
        label={t(item.labelKey as any)}
        icon={item.icon}
        channelCount={item.channelCount}
        countLabel={t('livetv.channelCount')}
        width={categoryCardWidth}
        height={categoryCardWidth * 0.95}
        onPress={() => setDrilldown({ kind: 'category', category: item })}
      />
    ),
    [t]
  );

  // ─── Country list ───
  const renderCountry = useCallback(
    ({ item }: { item: LiveCountry }) => (
      <TouchableOpacity
        style={[styles.countryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setDrilldown({ kind: 'country', country: item })}
        activeOpacity={0.75}
      >
        <Text style={styles.countryFlag}>{item.flag || '🌐'}</Text>
        <View style={styles.countryText}>
          <Text style={[styles.countryName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.countryCount, { color: colors.textMuted }]}>
            {item.channelCount.toLocaleString()} {t('livetv.channelCount')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    ),
    [colors, t]
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name={section === 'favourites' ? 'star-outline' : 'tv-outline'}
        size={44}
        color={colors.textMuted}
      />
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {searching
          ? t('search.noResults')
          : section === 'favourites'
            ? t('livetv.noFavourites')
            : t('livetv.noChannels')}
      </Text>
      {section === 'favourites' && !searching && (
        <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
          {t('livetv.noFavouritesHint')}
        </Text>
      )}
    </View>
  );

  const headerTitle = searching
    ? ''
    : drilldown?.kind === 'category'
      ? t(drilldown.category.labelKey as any)
      : drilldown?.kind === 'country'
        ? drilldown.country.name
        : t('livetv.title');

  const atTopLevel = !drilldown && !searching;
  const showBack = !atTopLevel;

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
  }, []);

  const goBack = useCallback(() => {
    if (searching) {
      closeSearch();
      return;
    }
    if (drilldown) {
      setDrilldown(null);
      return;
    }
    if (section !== 'categories') setSection('categories');
  }, [searching, drilldown, section, closeSearch]);

  if (isLoading && !catalog) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !catalog) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>{t('livetv.loadError')}</Text>
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={refresh}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>{t('livetv.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Favourites: recents first, then starred channels, de-duplicated so a
  // recently watched favourite is not listed twice.
  const starred = favourites;
  const favouriteList = [
    ...recents.filter((recent) => !starred.some((fav) => fav.id === recent.id)),
    ...starred,
  ];

  const list = searching
    ? { data: searchResults as any[], renderItem: renderChannel as any, numColumns: CHANNEL_COLUMNS, key: 'search' }
    : drilldown
      ? { data: visibleChannels as any[], renderItem: renderChannel as any, numColumns: CHANNEL_COLUMNS, key: `drill-${drilldown.kind}` }
      : section === 'categories'
        ? { data: (catalog?.categories ?? []) as any[], renderItem: renderCategory as any, numColumns: CATEGORY_COLUMNS, key: 'categories' }
        : section === 'countries'
          ? { data: (catalog?.countries ?? []) as any[], renderItem: renderCountry as any, numColumns: 1, key: 'countries' }
          : { data: favouriteList as any[], renderItem: renderChannel as any, numColumns: CHANNEL_COLUMNS, key: 'favourites' };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {showBack ? (
            <TouchableOpacity
              onPress={goBack}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.goBack')}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}

          {searchOpen ? (
            <TextInput
              style={[
                styles.searchInput,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              placeholder={t('livetv.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              accessibilityLabel={t('livetv.searchPlaceholder')}
            />
          ) : (
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {headerTitle}
            </Text>
          )}

          {searchOpen ? (
            <TouchableOpacity
              onPress={closeSearch}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setSearchOpen(true)}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={t('livetv.searchPlaceholder')}
            >
              <Ionicons name="search" size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {atTopLevel && (
          <View style={styles.tabs}>
            {(['categories', 'countries', 'favourites'] as Section[]).map((item) => {
              const active = section === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: active ? colors.accent : colors.surface,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setSection(item)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.tabText, { color: active ? '#fff' : colors.textSub }]}
                    numberOfLines={1}
                  >
                    {t(`livetv.${item}` as any)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {drilldown && (
          <Text style={[styles.subHeader, { color: colors.textMuted }]}>
            {visibleChannels.length.toLocaleString()} {t('livetv.channelCount')}
          </Text>
        )}

        {section === 'favourites' && atTopLevel && recents.length > 0 && (
          <TouchableOpacity onPress={clearRecents} style={styles.clearRecents}>
            <Text style={[styles.clearRecentsText, { color: colors.textMuted }]}>
              {t('livetv.clearRecents')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        key={list.key}
        data={list.data}
        renderItem={list.renderItem}
        keyExtractor={(item: any) => item.id ?? item.code ?? item.labelKey}
        numColumns={list.numColumns}
        columnWrapperStyle={list.numColumns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[
          styles.listContent,
          list.data.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onLayout={() => warmFirstScreen(visibleChannels)}
        removeClippedSubviews
        initialNumToRender={12}
        windowSize={5}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  loadingText: { fontSize: 13, marginTop: 4 },
  errorText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  header: { paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800' },
  searchInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 0.5,
    paddingHorizontal: 12,
    fontSize: 14,
  },

  tabs: { flexDirection: 'row', gap: 8, marginTop: 10 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5 },
  tabText: { fontSize: 12, fontWeight: '700' },

  subHeader: { fontSize: 11, fontWeight: '600', marginTop: 8 },
  clearRecents: { marginTop: 8, alignSelf: 'flex-start' },
  clearRecentsText: { fontSize: 11, fontWeight: '600' },

  listContent: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 90 },
  listContentEmpty: { flexGrow: 1 },
  columnWrapper: { gap: GUTTER, marginBottom: GUTTER },

  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    marginBottom: 8,
  },
  countryFlag: { fontSize: 24 },
  countryText: { flex: 1 },
  countryName: { fontSize: 14, fontWeight: '600' },
  countryCount: { fontSize: 11, marginTop: 2 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
  },
  emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 12, textAlign: 'center', maxWidth: 260 },
});

export default LiveTvScreen;
