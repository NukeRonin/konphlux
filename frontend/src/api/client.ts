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

/** Upload a listing image (multipart). Returns the public file URL to store on the listing. */
export async function uploadImage(uri: string, isWeb: boolean): Promise<string> {
  const name = `photo_${Date.now()}.jpg`;
  const form = new FormData();
  if (isWeb) {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    // native FormData file shape
    form.append("file", { uri, name, type: "image/jpeg" } as any);
  }
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${BASE}/api/bazaar/upload`, { method: "POST", headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as any)?.detail;
    throw new ApiError(typeof detail === "string" ? detail : `Upload failed (${res.status})`, res.status);
  }
  return `${BASE}/api/files/${(data as { path: string }).path}`;
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
  // sell / ownership
  seller_id?: string;
  is_seller?: boolean;
  created_at?: string;
  // auction
  kind?: "fixed" | "auction";
  is_auction?: boolean;
  ended?: boolean;
  starting_price_cents?: number;
  current_bid_cents?: number | null;
  bid_count?: number;
  highest_bidder_name?: string | null;
  seconds_left?: number;
  is_winner?: boolean;
  min_next_bid_cents?: number;
  can_bid?: boolean;
  can_buy?: boolean;
};

export type Bid = { id: string; bidder_name: string; amount_cents: number; created_at: string };

export type Booth = {
  id: string;
  name: string;
  description: string;
  image: string;
  owner_id: string;
  owner_name: string;
  listing_count: number;
  created_at: string;
  is_owner?: boolean;
  listings?: Listing[];
};

export type AppNotification = {
  id: string;
  type: string;
  listing_id: string | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

export type AnvilContribution = { id: string; body: string; author: string; created_at: string };

export type AnvilWork = {
  id: string;
  title: string;
  kind: "story" | "script";
  category: string;
  body: string;
  excerpt: string;
  author: string;
  author_id: string;
  applause: number;
  applauded: boolean;
  is_author: boolean;
  open_cowriting: boolean;
  contribution_count: number;
  created_at: string;
  contributions?: AnvilContribution[];
};

export type DatingProfile = {
  user_id: string;
  display_name: string;
  gender: "man" | "woman" | "nonbinary";
  seeking: string[];
  bio: string;
  tagline: string;
  photo: string;
  age: number | null;
};

export type SparkCard = {
  id: string;
  display_name: string;
  gender: string | null;
  age: number | null;
  tagline: string;
  bio: string;
  photo: string;
  matched_at?: string;
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

export type BBCourseCard = {
  id: string;
  title: string;
  category: string;
  level: string;
  icon: string;
  summary: string;
  lesson_count: number;
};
export type BBLesson = { title: string; body: string };
export type BBCourse = BBCourseCard & { lessons: BBLesson[]; completed: number[] };
export type BBHub = {
  fact_of_day: string;
  categories: string[];
  featured: BBCourseCard[];
  course_count: number;
  quiz_count: number;
  video_count: number;
  lessons_completed: number;
};
export type BBQuizCard = { id: string; title: string; category: string; icon: string; question_count: number };
export type BBQuizQuestion = { q: string; options: string[] };
export type BBQuiz = { id: string; title: string; category: string; icon: string; questions: BBQuizQuestion[] };
export type BBVideo = { id: string; title: string; topic: string; duration: string; url: string };

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
  getMyListings: () => request<Listing[]>("/bazaar/mine"),
  createListing: (payload: {
    title: string;
    description: string;
    category: string;
    image: string;
    kind: "fixed" | "auction";
    price_cents?: number;
    starting_price_cents?: number;
    duration_hours?: number;
    booth_id?: string | null;
  }) => request<Listing>("/bazaar", { method: "POST", body: JSON.stringify(payload) }),
  deleteListing: (id: string) => request<{ deleted: boolean; id: string }>(`/bazaar/${id}`, { method: "DELETE" }),
  placeBid: (id: string, amount_cents: number) =>
    request<Listing>(`/bazaar/${id}/bid`, { method: "POST", body: JSON.stringify({ amount_cents }) }),
  listBids: (id: string) => request<Bid[]>(`/bazaar/${id}/bids`),

  createBooth: (name: string, description: string, image: string) =>
    request<Booth>("/booths", { method: "POST", body: JSON.stringify({ name, description, image }) }),
  listBooths: () => request<Booth[]>("/booths"),
  myBooths: () => request<Booth[]>("/booths/mine"),
  boothDetail: (id: string) => request<Booth>(`/booths/${id}`),

  notifications: () => request<AppNotification[]>("/notifications"),
  unreadCount: () => request<{ count: number }>("/notifications/unread_count"),
  markNotificationsRead: () => request<{ ok: boolean }>("/notifications/read", { method: "POST" }),

  anvilList: (kind?: string, category?: string) => {
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    if (category) p.set("category", category);
    const qs = p.toString();
    return request<{ works: AnvilWork[]; categories: string[] }>(`/anvil${qs ? `?${qs}` : ""}`);
  },
  anvilPrompts: () => request<{ prompts: string[]; categories: string[] }>("/anvil/prompts"),
  anvilCowriting: () => request<AnvilWork[]>("/anvil/cowriting"),
  anvilWork: (id: string) => request<AnvilWork>(`/anvil/${id}`),
  anvilCreate: (payload: { title: string; kind: string; category: string; body: string; open_cowriting: boolean }) =>
    request<AnvilWork>("/anvil", { method: "POST", body: JSON.stringify(payload) }),
  anvilApplause: (id: string) =>
    request<{ id: string; applauded: boolean; applause: number }>(`/anvil/${id}/applause`, { method: "POST" }),
  anvilContribute: (id: string, body: string) =>
    request<AnvilContribution>(`/anvil/${id}/contribute`, { method: "POST", body: JSON.stringify({ body }) }),
  anvilAssist: (payload: { mode: string; title?: string; kind?: string; text?: string }) =>
    request<{ text: string }>("/anvil/assist", { method: "POST", body: JSON.stringify(payload) }),
  anvilAdventure: (history: { role: string; content: string }[], action: string) =>
    request<{ text: string }>("/anvil/adventure", { method: "POST", body: JSON.stringify({ history, action }) }),
  anvilGeno: (payload: { tool: string; topic: string; tone?: string; genre?: string; length?: string }) =>
    request<{ tool: string; title: string; text: string }>("/anvil/genoscribe", { method: "POST", body: JSON.stringify(payload) }),
  anvilAddPrompt: (text: string) =>
    request<{ id: string; text: string }>("/anvil/prompts", { method: "POST", body: JSON.stringify({ text }) }),
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

  datingMe: () => request<DatingProfile | null>("/dating/me"),
  datingSaveProfile: (payload: {
    gender: string;
    seeking: string[];
    bio: string;
    tagline: string;
    photo: string;
    age: number | null;
  }) => request<DatingProfile>("/dating/profile", { method: "POST", body: JSON.stringify(payload) }),
  datingDiscover: (seeking: string) => request<SparkCard[]>(`/dating/discover?seeking=${seeking}`),
  datingSwipe: (target_id: string, action: "like" | "pass") =>
    request<{ match: boolean; profile?: SparkCard }>("/dating/swipe", {
      method: "POST",
      body: JSON.stringify({ target_id, action }),
    }),
  datingMatches: () => request<SparkCard[]>("/dating/matches"),

  // BrainBoost (learning district)
  bbHub: () => request<BBHub>("/brainboost"),
  bbCourses: (category?: string) =>
    request<{ courses: BBCourseCard[]; categories: string[] }>(
      `/brainboost/courses${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    ),
  bbCourse: (id: string) => request<BBCourse>(`/brainboost/courses/${id}`),
  bbProgress: (id: string, lesson_index: number, completed: boolean) =>
    request<{ course_id: string; completed: number[]; total: number }>(`/brainboost/courses/${id}/progress`, {
      method: "POST",
      body: JSON.stringify({ lesson_index, completed }),
    }),
  bbQuizzes: () => request<BBQuizCard[]>("/brainboost/quizzes"),
  bbQuiz: (id: string) => request<BBQuiz>(`/brainboost/quizzes/${id}`),
  bbQuizSubmit: (id: string, answers: number[]) =>
    request<{ score: number; total: number; correct: number[] }>(`/brainboost/quizzes/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
  bbFacts: () => request<{ fact_of_day: string; date: string; more: string[] }>("/brainboost/facts"),
  bbVideos: () => request<BBVideo[]>("/brainboost/videos"),
  bbLexicon: (word: string, mode: "dictionary" | "thesaurus") =>
    request<{ word: string; mode: string; text: string }>("/brainboost/lexicon", {
      method: "POST",
      body: JSON.stringify({ word, mode }),
    }),
  bbRepair: (problem: string) =>
    request<{ steps: string }>("/brainboost/repair", { method: "POST", body: JSON.stringify({ problem }) }),
};
