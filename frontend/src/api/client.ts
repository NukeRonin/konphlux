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

export type Community = {
  id: string;
  name: string;
  description: string;
  icon: string;
  members: number;
  thread_count: number;
  member: boolean;
  threads?: Thread[];
};

export type Thread = {
  id: string;
  community_id: string;
  community_name: string;
  title: string;
  body: string;
  author: string;
  upvotes: number;
  voted: boolean;
  reply_count: number;
  created_at: string;
  replies?: Reply[];
};

export type Reply = {
  id: string;
  thread_id: string;
  body: string;
  author: string;
  created_at: string;
};

export type CartItem = {
  item_id: string;
  title: string;
  image: string;
  price_cents: number;
  qty: number;
  line_cents: number;
  seller: string;
};
export type Cart = { items: CartItem[]; subtotal_cents: number; count: number };

export type OrderLine = { item_id: string; title: string; qty: number; unit_amount: number; image: string };
export type Order = {
  id: string;
  session_id: string;
  status: string;
  payment_status: string;
  currency: string;
  amount_cents: number;
  lines: OrderLine[];
  created_at: string;
  paid_at?: string;
};

export type Answer = {
  id: string;
  question_id: string;
  body: string;
  author: string;
  upvotes: number;
  voted: boolean;
  is_best: boolean;
  created_at: string;
};

export type Question = {
  id: string;
  title: string;
  body: string;
  category: string;
  author: string;
  is_author: boolean;
  is_qotd: boolean;
  best_answer_id: string | null;
  answer_count: number;
  total_upvotes: number;
  created_at: string;
  answers?: Answer[];
};

export type AnswerfierBoard = { qotd: Question; questions: Question[]; categories: string[] };

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

  rtCommunities: (filter?: "joined") =>
    request<Community[]>(`/roundtable/communities${filter ? `?filter=${filter}` : ""}`),
  rtCommunity: (id: string) => request<Community>(`/roundtable/communities/${id}`),
  rtCreateCommunity: (name: string, description: string, icon: string) =>
    request<Community>("/roundtable/communities", {
      method: "POST",
      body: JSON.stringify({ name, description, icon }),
    }),
  rtJoin: (id: string) =>
    request<{ id: string; member: boolean; members: number }>(`/roundtable/communities/${id}/join`, {
      method: "POST",
    }),
  rtThreads: () => request<Thread[]>("/roundtable/threads"),
  rtMyThreads: () => request<Thread[]>("/roundtable/threads?mine=true"),
  rtThread: (id: string) => request<Thread>(`/roundtable/threads/${id}`),
  rtCreateThread: (community_id: string, title: string, body: string) =>
    request<Thread>("/roundtable/threads", {
      method: "POST",
      body: JSON.stringify({ community_id, title, body }),
    }),
  rtVote: (id: string) =>
    request<{ id: string; voted: boolean; upvotes: number }>(`/roundtable/threads/${id}/vote`, {
      method: "POST",
    }),
  rtReply: (id: string, body: string) =>
    request<Reply>(`/roundtable/threads/${id}/replies`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  getCart: () => request<Cart>("/cart"),
  addToCart: (item_id: string, qty = 1) =>
    request<Cart>("/cart", { method: "POST", body: JSON.stringify({ item_id, qty }) }),
  setCartQty: (item_id: string, qty: number) =>
    request<Cart>(`/cart/${item_id}`, { method: "PATCH", body: JSON.stringify({ qty }) }),
  removeFromCart: (item_id: string) => request<Cart>(`/cart/${item_id}`, { method: "DELETE" }),
  checkout: (return_base: string) =>
    request<{ session_id: string; checkout_url: string }>("/checkout", {
      method: "POST",
      body: JSON.stringify({ return_base }),
    }),
  checkoutStatus: (session_id: string) =>
    request<{ paid: boolean; order: Order }>(`/checkout/status/${session_id}`),
  getOrders: () => request<Order[]>("/orders"),

  afBoard: () => request<AnswerfierBoard>("/answerfier"),
  afQotd: () => request<Question>("/answerfier/qotd"),
  afCreateQuestion: (title: string, body: string, category: string) =>
    request<Question>("/answerfier/questions", {
      method: "POST",
      body: JSON.stringify({ title, body, category }),
    }),
  afQuestion: (id: string) => request<Question>(`/answerfier/questions/${id}`),
  afAddAnswer: (id: string, body: string) =>
    request<Answer>(`/answerfier/questions/${id}/answers`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  afSetBest: (id: string, answer_id: string) =>
    request<{ id: string; best_answer_id: string | null }>(`/answerfier/questions/${id}/best`, {
      method: "POST",
      body: JSON.stringify({ answer_id }),
    }),
  afVoteAnswer: (answer_id: string) =>
    request<{ id: string; voted: boolean; upvotes: number }>(`/answerfier/answers/${answer_id}/vote`, {
      method: "POST",
    }),
};
