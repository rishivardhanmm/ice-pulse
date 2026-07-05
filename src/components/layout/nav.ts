export interface NavItem {
  label: string;
  href: string;
  icon: string; // bootstrap-icons class, e.g. 'bi-grid-1x2'
  badge?: string;
  disabled?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/', icon: 'bi-grid-1x2-fill' }],
  },
  {
    label: 'Channels',
    items: [
      { label: 'Google Ads', href: '/google-ads', icon: 'bi-google' },
      { label: 'Meta Ads', href: '/meta-ads', icon: 'bi-meta' },
      { label: 'News Insights', href: '/news-insights', icon: 'bi-newspaper' },
      { label: 'Social Posts', href: '/social-posts', icon: 'bi-chat-square-heart' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Sync Centre', href: '/sync', icon: 'bi-arrow-repeat' },
      { label: 'Approvals', href: '/approvals', icon: 'bi-check2-square' },
      { label: 'Campaign Calendar', href: '/calendar', icon: 'bi-calendar3' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Ad Copy Studio', href: '/ad-copy', icon: 'bi-stars' },
      { label: 'Power BI', href: '/power-bi', icon: 'bi-bar-chart-line-fill' },
      { label: 'Reports', href: '/reports', icon: 'bi-file-earmark-text' },
      { label: 'Canva', href: '/canva', icon: 'bi-palette' },
      { label: 'Roadmap', href: '/roadmap', icon: 'bi-compass' },
    ],
  },
];

/** Nav sections shown only to admin/internal users. */
export const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    label: 'Admin',
    items: [
      { label: 'Client Management', href: '/admin/clients', icon: 'bi-people-fill' },
      { label: 'Team', href: '/admin/team', icon: 'bi-person-badge' },
      { label: 'Team Roles', href: '/admin/roles', icon: 'bi-shield-check' },
    ],
  },
];

export interface RouteMeta {
  title: string;
  crumb: string;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  '/': { title: 'Dashboard Overview', crumb: 'Overview' },
  '/google-ads': { title: 'Google Ads Performance', crumb: 'Channels' },
  '/meta-ads': { title: 'Meta Ads Performance', crumb: 'Channels' },
  '/sync': { title: 'Sync Centre', crumb: 'Operations' },
  '/approvals': { title: 'Content Approvals', crumb: 'Operations' },
  '/news-insights': { title: 'News Insights', crumb: 'Channels' },
  '/calendar': { title: 'Campaign Calendar', crumb: 'Operations' },
  '/social-posts': { title: 'Social Posts', crumb: 'Channels' },
  '/ad-copy': { title: 'Ad Copy Studio', crumb: 'Platform' },
  '/power-bi': { title: 'Power BI Reports', crumb: 'Platform' },
  '/reports': { title: 'Client Reports', crumb: 'Platform' },
  '/canva': { title: 'Canva Integration', crumb: 'Platform' },
  '/roadmap': { title: 'Roadmap & Future Modules', crumb: 'Platform' },
  '/admin/team': { title: 'Team Management', crumb: 'Admin' },
  '/admin/roles': { title: 'Team Roles', crumb: 'Admin' },
};

export function routeMetaFor(pathname: string): RouteMeta {
  if (pathname.startsWith('/google-ads')) return ROUTE_META['/google-ads'];
  if (pathname.startsWith('/meta-ads')) return ROUTE_META['/meta-ads'];
  if (pathname.startsWith('/approvals')) return ROUTE_META['/approvals'];
  if (pathname.startsWith('/news-insights')) return ROUTE_META['/news-insights'];
  if (pathname.startsWith('/calendar')) return ROUTE_META['/calendar'];
  if (pathname.startsWith('/social-posts')) return ROUTE_META['/social-posts'];
  if (pathname.startsWith('/power-bi')) return ROUTE_META['/power-bi'];
  return ROUTE_META[pathname] ?? { title: 'ICE Pulse', crumb: 'Platform' };
}
