export interface AchievementDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  criteriaType:
    | 'BLOG_COUNT'
    | 'COMMUNITY_POST_COUNT'
    | 'FOLLOWER_COUNT'
    | 'LIKES_RECEIVED'
    | 'EVENTS_ORGANIZED'
    | 'COMMUNITIES_JOINED';
  criteriaThreshold: number;
}

/**
 * The full achievement catalog. `icon` is a lucide-react / Ionicons name
 * shared by both frontends — pick names that exist in both icon sets.
 * Add new achievements here; AchievementsService.ensureSeeded() upserts
 * them by `key` on startup, so existing user progress is never lost when
 * this list grows.
 */
export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  {
    key: 'first_post',
    name: 'First Words',
    description: 'Published your first blog post',
    icon: 'edit-3',
    criteriaType: 'BLOG_COUNT',
    criteriaThreshold: 1,
  },
  {
    key: 'prolific_writer',
    name: 'Prolific Writer',
    description: 'Published 10 blog posts',
    icon: 'book-open',
    criteriaType: 'BLOG_COUNT',
    criteriaThreshold: 10,
  },
  {
    key: 'community_voice',
    name: 'Community Voice',
    description: 'Shared 5 posts in communities',
    icon: 'message-circle',
    criteriaType: 'COMMUNITY_POST_COUNT',
    criteriaThreshold: 5,
  },
  {
    key: 'rising_star',
    name: 'Rising Star',
    description: 'Reached 10 followers',
    icon: 'trending-up',
    criteriaType: 'FOLLOWER_COUNT',
    criteriaThreshold: 10,
  },
  {
    key: 'beloved',
    name: 'Beloved',
    description: 'Reached 100 followers',
    icon: 'heart-handshake',
    criteriaType: 'FOLLOWER_COUNT',
    criteriaThreshold: 100,
  },
  {
    key: 'well_liked',
    name: 'Well-Liked',
    description: 'Earned 50 likes across your posts',
    icon: 'thumbs-up',
    criteriaType: 'LIKES_RECEIVED',
    criteriaThreshold: 50,
  },
  {
    key: 'community_pillar',
    name: 'Community Pillar',
    description: 'Earned 500 likes across your posts',
    icon: 'award',
    criteriaType: 'LIKES_RECEIVED',
    criteriaThreshold: 500,
  },
  {
    key: 'event_organizer',
    name: 'Event Organizer',
    description: 'Organized your first event',
    icon: 'calendar-check',
    criteriaType: 'EVENTS_ORGANIZED',
    criteriaThreshold: 1,
  },
  {
    key: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Joined 3 communities',
    icon: 'users',
    criteriaType: 'COMMUNITIES_JOINED',
    criteriaThreshold: 3,
  },
];
