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

/** Build a public URL for a stored object path returned by the backend. */
export function fileUrl(path: string): string {
  return path ? `${BASE}/api/files/${path}` : "";
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

/** Upload a resume document (pdf/doc/txt). Returns the stored object path. */
export async function uploadResume(uri: string, isWeb: boolean, mimeType: string, name: string): Promise<string> {
  const form = new FormData();
  if (isWeb) {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type: mimeType } as any);
  }
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${BASE}/api/profession/upload-resume`, { method: "POST", headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as any)?.detail;
    throw new ApiError(typeof detail === "string" ? detail : `Upload failed (${res.status})`, res.status);
  }
  return (data as { path: string }).path;
}

/** Upload an audio file (soundtrack or recorded voice-over). Returns the stored object path. */
export async function uploadAudio(uri: string, isWeb: boolean, mimeType = "audio/m4a", name = `audio_${Date.now()}.m4a`): Promise<string> {
  const form = new FormData();
  if (isWeb) {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type: mimeType } as any);
  }
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${BASE}/api/pictureshow/upload-audio`, { method: "POST", headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as any)?.detail;
    throw new ApiError(typeof detail === "string" ? detail : `Upload failed (${res.status})`, res.status);
  }
  return (data as { path: string }).path;
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

// PictureShow
export type PSVideoCard = {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  views: number;
  likes: number;
  category: string;
  channel_id: string;
  channel_name: string;
  channel_avatar: string;
};
export type PSChannelLite = { id: string; name: string; avatar: string; subscribers: number };
export type PSHub = {
  featured: PSVideoCard[];
  trending: PSVideoCard[];
  categories: string[];
  channels: PSChannelLite[];
  video_count: number;
  subscriptions: number;
  live_count: number;
};
export type PSVideoDetail = PSVideoCard & {
  description: string;
  video_url: string;
  channel_subscribers: number;
  liked: boolean;
  subscribed: boolean;
  related: PSVideoCard[];
  my_playlists: { id: string; title: string }[];
};
export type PSChannel = PSChannelLite & { description: string; video_count?: number; subscribed?: boolean; videos?: PSVideoCard[] };
export type PSPlaylistCard = { id: string; title: string; count: number; thumbnail?: string; mine?: boolean };
export type PSStream = {
  id: string;
  title: string;
  thumbnail: string;
  video_url: string;
  status: "live" | "upcoming" | "recent";
  viewers: number;
  category: string;
  scheduled_at: string;
  channel_id: string;
  channel_name: string;
  channel_avatar: string;
};
export type PSStreamoraHub = {
  live: PSStream[];
  upcoming: PSStream[];
  recent: PSStream[];
  clips: (PSVideoCard & { video_url: string })[];
  followed: { id: string; name: string; avatar: string }[];
};

// Chatterbox
export type CBUser = { id: string; display_name: string; handle: string; avatar: string; bot: boolean };
export type CBConvSummary = {
  id: string;
  type: "dm" | "group";
  title: string;
  avatar: string;
  participants: CBUser[];
  member_count: number;
  last_message: string;
  last_at: string;
  unread: number;
};
export type CBMessage = { id: string; conversation_id: string; sender_id: string; sender_name: string; text: string; created_at: string; kind?: string; meta?: Record<string, any> };
export type CBConvDetail = CBConvSummary & { messages: CBMessage[]; me: string; other_id?: string };

// Bluepaint Space Designer
export type BPWall = { x1: number; y1: number; x2: number; y2: number };
export type BPItem = { id: string; kind: string; x: number; y: number; rotation: number; scale: number };
export type BPDesignSummary = { id: string; name: string; wall_count: number; item_count: number; updated_at: string; walls: BPWall[]; items: BPItem[] };
export type BPDesign = { id: string; name: string; walls: BPWall[]; items: BPItem[]; created_at: string; updated_at: string };

export type DBFundingModel = "all_or_nothing" | "keep_what_you_raise";
export type DBRewardTier = { id: string; title: string; description: string; amount_cents: number; backer_count: number };
export type DBUpdate = { id: string; project_id: string; title: string; body: string; author_name: string; created_at: string };
export type DBBacker = { backer_name: string; amount_cents: number; tier_title: string | null; paid_at: string };
export type DBComment = { id: string; project_id: string; user_id: string; author_name: string; is_creator: boolean; body: string; parent_id: string | null; created_at: string };
export type DBRecurringSupporter = { backer_name: string; amount_cents: number; since: string };
export type DBProject = {
  id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  description: string;
  goal_cents: number;
  funding_model: DBFundingModel;
  deadline: string | null;
  cover_url: string | null;
  reward_tiers: DBRewardTier[];
  raised_cents: number;
  backer_count: number;
  progress: number;
  is_creator: boolean;
  created_at: string;
  category: string;
  funded: boolean;
  celebrate?: boolean;
};

export type FrankVaultItem = { id: string; kind: string; prompt: string; image_path: string; concept: string; title: string; created_at: string };

export type PSCharacter = { id: string; name: string; description: string; reference_path: string; created_at: string };

export type PSSuiteConfig = {
  prompt: string;
  kind: "video" | "animation";
  style?: string;
  length?: string;
  speed?: string;
  transitions?: string[];
  atmospherics?: string[];
  titles?: string[];
  finishing?: string[];
  audio_effects?: string[];
  character_ids?: string[];
  has_soundtrack?: boolean;
  has_voiceover?: boolean;
};

export type PSPreset = { id: string; name: string; style: string; length: string; speed: string; transitions: string[]; atmospherics: string[]; titles: string[]; finishing: string[]; audio_effects: string[]; created_at: string };

export type JobInput = { title: string; company: string; location: string; job_type: string; category: string; salary_min: number; salary_max: number; remote: boolean; description: string };

export type Job = JobInput & {
  id: string;
  poster_id: string;
  poster_name: string;
  status: string;
  created_at: string;
  has_applied?: boolean;
  is_owner?: boolean;
  my_application_status?: string;
  applicant_count?: number;
  saved?: boolean;
};

export type JobApplication = {
  id: string;
  job_id: string;
  applicant_id: string;
  applicant_name: string;
  cover_note: string;
  status: string;
  created_at: string;
  job_title: string;
  company: string;
  job_open: boolean;
};

export type Applicant = {
  id: string;
  job_id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_handle: string;
  cover_note: string;
  resume_link?: string;
  resume_path?: string;
  status: string;
  created_at: string;
};

export type ExperienceItem = { role: string; org: string; detail: string };

export type FreelancerInput = {
  name: string;
  headline: string;
  bio: string;
  category: string;
  skills: string[];
  hourly_rate: number;
  location: string;
  avatar_url: string;
  links: string[];
  experience: ExperienceItem[];
  available: boolean;
};

export type Freelancer = FreelancerInput & {
  id: string;
  user_id: string;
  handle: string;
  created_at: string;
  updated_at: string;
  is_me?: boolean;
  avg_rating?: number;
  review_count?: number;
  featured?: boolean;
  can_review?: boolean;
  reviews?: FreelancerReview[];
};

export type FreelancerReview = { id: string; reviewer_name: string; rating: number; comment: string; job_title: string; created_at: string };

export type Interview = { id: string; job_id: string; conversation_id: string; poster_id: string; poster_name: string; applicant_id: string; applicant_name: string; title: string; scheduled_at: string; location: string; status: string; role?: string; created_at: string };

export type CalendarItem = { id: string; type: string; title: string; when: string; location: string; note: string; status: string; color: string; deletable: boolean };

export type Contract = { id: string; offer_id: string; conversation_id: string; client_id: string; client_name: string; freelancer_id: string; freelancer_name: string; title: string; rate_text: string; note: string; status: string; accepted_at: string; role?: string };

export type PSProject = {
  id: string;
  title: string;
  prompt: string;
  kind: "video" | "animation";
  style: string;
  length: string;
  speed: string;
  transitions: string[];
  atmospherics: string[];
  titles: string[];
  finishing: string[];
  audio_effects: string[];
  character_ids: string[];
  soundtrack_path: string;
  voiceover_path: string;
  storyboard: string;
  poster_path: string;
  render_status?: string;
  video_url?: string;
  created_at: string;
};


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

  // PictureShow (video district + Streamora live branch)
  psHub: () => request<PSHub>("/pictureshow"),
  psVideos: (category?: string, sort: "recent" | "trending" = "recent") =>
    request<{ videos: PSVideoCard[]; categories: string[] }>(
      `/pictureshow/videos?sort=${sort}${category ? `&category=${encodeURIComponent(category)}` : ""}`,
    ),
  psTrending: () => request<{ videos: PSVideoCard[] }>("/pictureshow/trending"),
  psVideo: (id: string) => request<PSVideoDetail>(`/pictureshow/videos/${id}`),
  psLike: (id: string) => request<{ liked: boolean; likes: number }>(`/pictureshow/videos/${id}/like`, { method: "POST" }),
  psCreateVideo: (body: { title: string; video_url: string; category: string; description: string; thumbnail?: string }) =>
    request<PSVideoCard>("/pictureshow/videos", { method: "POST", body: JSON.stringify(body) }),
  psChannels: () => request<PSChannel[]>("/pictureshow/channels"),
  psChannel: (id: string) => request<PSChannel>(`/pictureshow/channels/${id}`),
  psSubscribe: (id: string) => request<{ subscribed: boolean }>(`/pictureshow/channels/${id}/subscribe`, { method: "POST" }),
  psSubscriptions: () => request<{ channels: PSChannelLite[]; videos: PSVideoCard[] }>("/pictureshow/subscriptions"),
  psPlaylists: () => request<PSPlaylistCard[]>("/pictureshow/playlists"),
  psPlaylist: (id: string) => request<{ id: string; title: string; videos: PSVideoCard[] }>(`/pictureshow/playlists/${id}`),
  psCreatePlaylist: (title: string) => request<PSPlaylistCard>("/pictureshow/playlists", { method: "POST", body: JSON.stringify({ title }) }),
  psPlaylistAdd: (id: string, video_id: string) =>
    request<{ id: string; count: number }>(`/pictureshow/playlists/${id}/add`, { method: "POST", body: JSON.stringify({ video_id }) }),
  streamoraHub: () => request<PSStreamoraHub>("/pictureshow/streamora"),
  streamoraGoLive: (body: { title: string; category: string; when: string }) =>
    request<PSStream>("/pictureshow/streamora/golive", { method: "POST", body: JSON.stringify(body) }),
  streamoraFollow: (channel_id: string) =>
    request<{ following: boolean }>(`/pictureshow/streamora/${channel_id}/follow`, { method: "POST" }),
  psAiConcept: (body: { prompt: string; kind: "video" | "animation"; style?: string }) =>
    request<{ kind: string; storyboard: string; poster_path: string }>("/pictureshow/ai/concept", { method: "POST", body: JSON.stringify(body) }),
  psAiSuite: (body: PSSuiteConfig) =>
    request<{ kind: string; storyboard: string; poster_path: string }>("/pictureshow/ai/suite", { method: "POST", body: JSON.stringify(body) }),
  psCharacters: () => request<PSCharacter[]>("/pictureshow/characters"),
  psCreateCharacter: (body: { name: string; description: string; reference_path: string }) =>
    request<PSCharacter>("/pictureshow/characters", { method: "POST", body: JSON.stringify(body) }),
  psDeleteCharacter: (id: string) => request<{ deleted: boolean }>(`/pictureshow/characters/${id}`, { method: "DELETE" }),
  psProjects: () => request<PSProject[]>("/pictureshow/projects"),
  psProject: (id: string) => request<PSProject>(`/pictureshow/projects/${id}`),
  psSaveProject: (body: Partial<PSProject> & { prompt: string; kind: "video" | "animation" }) =>
    request<PSProject>("/pictureshow/projects", { method: "POST", body: JSON.stringify(body) }),
  psDeleteProject: (id: string) => request<{ deleted: boolean }>(`/pictureshow/projects/${id}`, { method: "DELETE" }),
  psPresets: () => request<PSPreset[]>("/pictureshow/presets"),
  psSavePreset: (body: Omit<PSPreset, "id" | "created_at">) =>
    request<PSPreset>("/pictureshow/presets", { method: "POST", body: JSON.stringify(body) }),
  psDeletePreset: (id: string) => request<{ deleted: boolean }>(`/pictureshow/presets/${id}`, { method: "DELETE" }),
  psRender: (id: string) => request<{ status: string }>(`/pictureshow/projects/${id}/render`, { method: "POST" }),
  psRenderStatus: (id: string) => request<{ status: string; video_url: string }>(`/pictureshow/projects/${id}/render-status`),
  frankAudio: (body: { kind: "music" | "sfx"; prompt: string; mood?: string; genre?: string; duration?: string }) =>
    request<{ kind: string; concept: string; image_path: string }>("/frankenstein/audio", { method: "POST", body: JSON.stringify(body) }),
  frankVisual: (body: { kind: "pic" | "logo" | "gif" | "meme"; prompt: string }) =>
    request<{ kind: string; image_path: string }>("/frankenstein/visual", { method: "POST", body: JSON.stringify(body) }),
  frankVaultSave: (body: { kind: string; prompt?: string; image_path?: string; concept?: string; title?: string }) =>
    request<FrankVaultItem>("/frankenstein/vault", { method: "POST", body: JSON.stringify(body) }),
  frankVault: (kind?: string) => request<FrankVaultItem[]>(`/frankenstein/vault${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`),
  frankVaultDelete: (id: string) => request<{ deleted: boolean }>(`/frankenstein/vault/${id}`, { method: "DELETE" }),

  // Chatterbox (private messaging + group chats)
  cbUsers: (q?: string) => request<CBUser[]>(`/chatterbox/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  cbConversations: () => request<{ conversations: CBConvSummary[]; total_unread: number }>("/chatterbox/conversations"),
  cbStartDm: (user_id: string) => request<CBConvSummary>("/chatterbox/conversations/dm", { method: "POST", body: JSON.stringify({ user_id }) }),
  cbCreateGroup: (title: string, member_ids: string[]) =>
    request<CBConvSummary>("/chatterbox/conversations/group", { method: "POST", body: JSON.stringify({ title, member_ids }) }),
  cbConversation: (id: string) => request<CBConvDetail>(`/chatterbox/conversations/${id}`),
  cbPoll: (id: string, after: string) => request<{ messages: CBMessage[] }>(`/chatterbox/conversations/${id}/messages?after=${encodeURIComponent(after)}`),
  cbSend: (id: string, text: string) => request<{ message: CBMessage }>(`/chatterbox/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ text }) }),

  // Bluepaint Space Designer
  bpDesigns: () => request<BPDesignSummary[]>("/bluepaint/designs"),
  bpCreateDesign: (name: string) => request<BPDesign>("/bluepaint/designs", { method: "POST", body: JSON.stringify({ name }) }),
  bpDesign: (id: string) => request<BPDesign>(`/bluepaint/designs/${id}`),
  bpSaveDesign: (id: string, data: { name?: string; walls: BPWall[]; items: BPItem[] }) =>
    request<BPDesign>(`/bluepaint/designs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  bpDeleteDesign: (id: string) => request<{ deleted: boolean }>(`/bluepaint/designs/${id}`, { method: "DELETE" }),
  bpReview: (id: string, planWidth: number) =>
    request<{
      summary: { wall_count: number; total_wall_len: number; bbox_w: number; bbox_d: number; floor_area: number; doors: number; windows: number; furniture: Record<string, number> };
      review: string;
    }>(`/bluepaint/designs/${id}/review`, { method: "POST", body: JSON.stringify({ plan_width: planWidth }) }),

  dbProjects: (filter: string, category?: string) => request<DBProject[]>(`/dreambacker/projects?filter=${encodeURIComponent(filter)}${category ? `&category=${encodeURIComponent(category)}` : ""}`),
  dbProject: (id: string) => request<DBProject>(`/dreambacker/projects/${id}`),
  dbCreateProject: (data: { title: string; description: string; goal_cents: number; funding_model: DBFundingModel; deadline: string | null; cover_url: string | null; reward_tiers: { title: string; description: string; amount_cents: number }[]; category: string }) =>
    request<DBProject>("/dreambacker/projects", { method: "POST", body: JSON.stringify(data) }),
  dbEditProject: (id: string, data: { title?: string; description?: string; goal_cents?: number; cover_url?: string | null; category?: string }) =>
    request<DBProject>(`/dreambacker/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  dbDeleteProject: (id: string) => request<{ deleted: boolean }>(`/dreambacker/projects/${id}`, { method: "DELETE" }),
  dbBackProject: (id: string, amount_cents: number, return_base: string, tier_id: string | null, recurring: boolean) =>
    request<{ session_id: string; checkout_url: string }>(`/dreambacker/projects/${id}/back`, { method: "POST", body: JSON.stringify({ amount_cents, return_base, tier_id, recurring }) }),
  dbContributionStatus: (session_id: string) =>
    request<{ paid: boolean; contribution: { id: string; amount_cents: number; status: string } }>(`/dreambacker/contributions/status/${session_id}`),
  dbBackers: (id: string) => request<{ count: number; backers: DBBacker[] }>(`/dreambacker/projects/${id}/backers`),
  dbUpdates: (id: string) => request<DBUpdate[]>(`/dreambacker/projects/${id}/updates`),
  dbCreateUpdate: (id: string, title: string, body: string) =>
    request<DBUpdate>(`/dreambacker/projects/${id}/updates`, { method: "POST", body: JSON.stringify({ title, body }) }),
  dbComments: (id: string) => request<DBComment[]>(`/dreambacker/projects/${id}/comments`),
  dbCreateComment: (id: string, body: string, parent_id: string | null) =>
    request<DBComment>(`/dreambacker/projects/${id}/comments`, { method: "POST", body: JSON.stringify({ body, parent_id }) }),
  dbRecurring: (id: string) => request<{ count: number; monthly_total_cents: number; supporters: DBRecurringSupporter[] }>(`/dreambacker/projects/${id}/recurring`),
  dbMyBackings: () => request<(DBProject & { your_total_cents: number; your_recurring: boolean; can_cancel_recurring: boolean })[]>("/dreambacker/my-backings"),
  dbCancelRecurring: (projectId: string) => request<{ cancelled: number }>(`/dreambacker/backings/${projectId}/cancel-recurring`, { method: "POST" }),
  dbAlerts: () => request<{ count: number; project_ids: string[] }>("/dreambacker/alerts"),
  dbMarkSeen: (id: string) => request<{ ok: boolean }>(`/dreambacker/projects/${id}/seen`, { method: "POST" }),

  // Profession Plaza — Job Board
  jobMeta: () => request<{ categories: string[]; job_types: string[] }>("/profession/meta"),
  jobList: (q?: string, category?: string) =>
    request<Job[]>(`/profession/jobs?q=${encodeURIComponent(q || "")}&category=${encodeURIComponent(category || "")}`),
  jobsMine: () => request<Job[]>("/profession/jobs/mine"),
  jobApplicationsMine: () => request<JobApplication[]>("/profession/applications/mine"),
  jobGet: (id: string) => request<Job>(`/profession/jobs/${id}`),
  jobCreate: (body: JobInput) => request<Job>("/profession/jobs", { method: "POST", body: JSON.stringify(body) }),
  jobUpdate: (id: string, body: JobInput) => request<Job>(`/profession/jobs/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  jobToggleClose: (id: string) => request<{ status: string }>(`/profession/jobs/${id}/close`, { method: "POST" }),
  jobDelete: (id: string) => request<{ deleted: boolean }>(`/profession/jobs/${id}`, { method: "DELETE" }),
  jobApply: (id: string, body: { cover_note: string; resume_link?: string; resume_path?: string }) => request<{ id: string }>(`/profession/jobs/${id}/apply`, { method: "POST", body: JSON.stringify(body) }),
  jobApplicants: (id: string) => request<{ job: Job; applicants: Applicant[] }>(`/profession/jobs/${id}/applicants`),
  jobSetStatus: (appId: string, status: string) => request<{ status: string }>(`/profession/applications/${appId}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  jobToggleSave: (id: string) => request<{ saved: boolean }>(`/profession/jobs/${id}/save`, { method: "POST" }),
  jobsSaved: () => request<Job[]>("/profession/saved"),
  jobGigs: (q?: string, category?: string) => request<Job[]>(`/profession/gigs?q=${encodeURIComponent(q || "")}&category=${encodeURIComponent(category || "")}`),
  jobAlertPrefs: () => request<{ categories: string[]; keywords: string[] }>("/profession/alerts/prefs"),
  jobSetAlertPrefs: (categories: string[], keywords: string[]) => request<{ categories: string[]; keywords: string[] }>("/profession/alerts/prefs", { method: "PUT", body: JSON.stringify({ categories, keywords }) }),
  freelancers: (q?: string, category?: string, sort?: string) => request<Freelancer[]>(`/profession/freelancers?q=${encodeURIComponent(q || "")}&category=${encodeURIComponent(category || "")}&sort=${sort || "featured"}`),
  freelancerMe: () => request<Freelancer | Record<string, never>>("/profession/freelancer/me"),
  freelancerSave: (body: FreelancerInput) => request<Freelancer>("/profession/freelancer/me", { method: "PUT", body: JSON.stringify(body) }),
  freelancerGet: (id: string) => request<Freelancer>(`/profession/freelancers/${id}`),
  freelancerReview: (id: string, rating: number, comment: string, job_title: string) =>
    request<FreelancerReview>(`/profession/freelancers/${id}/review`, { method: "POST", body: JSON.stringify({ rating, comment, job_title }) }),
  sendOffer: (body: { conversation_id: string; to_user_id: string; title: string; rate_text: string; note: string }) =>
    request<{ id: string }>("/profession/offers", { method: "POST", body: JSON.stringify(body) }),
  respondOffer: (id: string, accept: boolean) => request<{ status: string; contract_id: string }>(`/profession/offers/${id}/respond`, { method: "POST", body: JSON.stringify({ accept }) }),
  scheduleInterview: (body: { to_user_id: string; conversation_id?: string; job_id?: string; title: string; scheduled_at: string; location: string }) =>
    request<Interview>("/profession/interviews", { method: "POST", body: JSON.stringify(body) }),
  respondInterview: (id: string, status: "confirmed" | "declined") =>
    request<{ status: string }>(`/profession/interviews/${id}/respond`, { method: "POST", body: JSON.stringify({ status }) }),
  eventionInterviews: () => request<{ upcoming: Interview[]; past: Interview[] }>("/evention/interviews"),
  rescheduleInterview: (id: string, scheduled_at: string) => request<{ status: string }>(`/profession/interviews/${id}/reschedule`, { method: "POST", body: JSON.stringify({ scheduled_at }) }),
  contracts: () => request<Contract[]>("/profession/contracts"),
  contract: (id: string) => request<Contract>(`/profession/contracts/${id}`),
  eventionCalendar: () => request<{ upcoming: CalendarItem[]; past: CalendarItem[] }>("/evention/calendar"),
  eventionAddEvent: (body: { type: string; title: string; when: string; location: string; note: string }) => request<CalendarItem>("/evention/events", { method: "POST", body: JSON.stringify(body) }),
  eventionDeleteEvent: (id: string) => request<{ deleted: boolean }>(`/evention/events/${id}`, { method: "DELETE" }),
};
