const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export type Chatmonger = { name: string; role: string; greeting: string };

export type District = {
  slug: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  chatmonger: Chatmonger;
  features: string[];
  nearby?: District[];
};

export type Post = {
  id: string;
  author: string;
  kind: string;
  time: string;
  body: string;
  likes: number;
  comments: number;
  liked: boolean;
};

export type FeedResponse = {
  stories: string[];
  trending: string[];
  suggestions: string[];
  posts: Post[];
};

export type Listing = {
  id: string;
  title: string;
  price_cents: number;
  seller: string;
  rating: number;
  reviews: number;
  category: string;
  image: string;
  description: string;
};

export type BazaarResponse = { categories: string[]; listings: Listing[] };

export type MenuItem = { label: string; icon: string; to: string };
export type MenuGroup = { group: string; items: MenuItem[] };
export type Profile = {
  display_name: string;
  handle: string;
  title: string;
  bio: string;
  district: string;
  stats: { posts: number; followers: number; following: number };
  balance_cents: number;
  menu: MenuGroup[];
};

export const api = {
  getDistricts: () => request<District[]>("/districts"),
  getDistrict: (slug: string) => request<District>(`/districts/${slug}`),
  getFeed: () => request<FeedResponse>("/feed"),
  createPost: (body: string) =>
    request<Post>("/feed", { method: "POST", body: JSON.stringify({ body }) }),
  likePost: (id: string) =>
    request<{ id: string; liked: boolean; likes: number }>(`/feed/${id}/like`, { method: "POST" }),
  getBazaar: () => request<BazaarResponse>("/bazaar"),
  getListing: (id: string) => request<Listing>(`/bazaar/${id}`),
  getProfile: () => request<Profile>("/profile"),
};
