/**
 * Cache Time-To-Live constants (in seconds)
 */
export const CacheTTL = {
    // Book related
    BOOK_DETAIL: 600, // 10 minutes
    BOOK_LIST_POPULAR: 900, // 15 minutes
    BOOK_LIST_TRENDING: 900, // 15 minutes
    BOOK_LIST_LATEST: 300, // 5 minutes
    BOOK_LIST_CATEGORY: 3600, // 10 minutes
    BOOK_SIMILAR: 3600, // 1 hour

    // Recommendations
    USER_RECOMMENDATIONS: 3600, // 1 hour (handled by worker)

    // Categories & Authors
    CATEGORIES_ALL: 3600, // 1 hour
    AUTHORS_ALL: 1800, // 30 minutes

    // Banners
    BANNERS_ACTIVE: 1800, // 30 minutes

    // Analytics
    ANALYTICS_OVERVIEW: 7200, // 2 hours

    // Default
    DEFAULT: 300, // 5 minutes
} as const;

/**
 * Cache key prefixes
 */
export const CachePrefix = {
    // Books
    BOOK_DETAIL: 'book:detail',
    BOOK_LIST_POPULAR: 'book:list:popular',
    BOOK_LIST_TRENDING: 'book:list:trending',
    BOOK_LIST_LATEST: 'book:list:latest',
    BOOK_LIST_CATEGORY: 'book:list:category',
    BOOK_SIMILAR: 'book:similar',
    BOOK_VIEWS: 'book:views',

    // Recommendations (keep existing pattern for Python worker compatibility)
    USER_RECOMMENDATIONS: 'user:recs',
    BOOK_RECOMMENDATIONS: 'book:recs', // Similar books from worker

    // Categories & Authors
    CATEGORIES_ALL: 'categories:all',
    AUTHORS_ALL: 'authors:all',

    // Banners
    BANNERS_ACTIVE: 'banners:active',

    // Analytics
    ANALYTICS_OVERVIEW: 'analytics:overview',
} as const;

export type CacheKey = (typeof CachePrefix)[keyof typeof CachePrefix];
