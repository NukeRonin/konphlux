const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as any)?.detail;
    const msg = typeof detail === "string" ? detail : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
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
  saved?: boolean;
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
  saved: boolean;
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
  saved?: boolean;
};

export type BazaarResponse = { categories: string[]; listings: Listing[] };

export type MenuItem = { label: string; icon: string; to: string };
export type MenuGroup = { group: string; items: MenuItem[] };
export type Profile = {
  display_name: string;
  handle: string;
  email?: string;
  title: string;
  bio: string;
  district: string;
  stats: { posts: number; followers: number; saved: number };
  balance_cents: number;
  menu: MenuGroup[];
};

export type AuthUser = { id: string; email: string; display_name: string; handle: string };
export type AuthResponse = { access_token: string; token_type: string; user: AuthUser };

export type SaveKind = "post" | "listing" | "district";
export type ChatMessage = { role: "user" | "assistant"; text: string; created_at: string };
export type ChatHistory = { chatmonger: Chatmonger; district: string; messages: ChatMessage[] };
export type SavesResponse = { posts: Post[]; listings: Listing[]; districts: District[] };

export const api = {
  register: (email: string, password: string, display_name: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<AuthUser>("/auth/me"),

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

  toggleSave: (kind: SaveKind, item_id: string) =>
    request<{ saved: boolean; kind: SaveKind; item_id: string }>("/saves", {
      method: "POST",
      body: JSON.stringify({ kind, item_id }),
    }),
  getSaves: () => request<SavesResponse>("/saves"),

  chatHistory: (slug: string) => request<ChatHistory>(`/chatmonger/${slug}`),
  chatSend: (slug: string, message: string) =>
    request<ChatMessage>(`/chatmonger/${slug}`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
