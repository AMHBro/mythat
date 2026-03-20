const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS:
// - عند تحديد CLIENT_ORIGIN (يمكن أن تكون قائمة مفصولة بفواصل) نسمح فقط بتلك الـ origins.
// - إذا لم يتم تحديدها نسمح بالـ origins بشكل عام (مناسب لـ MVP وبيئات مثل Vercel).
const corsOriginEnv = process.env.CLIENT_ORIGIN;
const corsOrigins = corsOriginEnv
  ? corsOriginEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
  })
);
app.use(express.json());

const STORE_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(STORE_DIR, "store.json");

const defaultDb = {
  __seq: 1,
  accounts: [],
  ideas: [],
  posts: [],
  campaigns: [],
  metrics: [],
};

function ensureStoreDir() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function loadStore() {
  ensureStoreDir();
  if (!fs.existsSync(STORE_PATH)) return defaultDb;
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== "object") return defaultDb;
  return { ...defaultDb, ...parsed };
}

function saveStore(store) {
  ensureStoreDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

const db = loadStore();
let seq = Number(db.__seq || 1);
const nextId = () => String(seq++);
function commit() {
  db.__seq = seq;
  saveStore(db);
}

const now = () => new Date().toISOString();
const entitiesWithAccount = new Set(["ideas", "posts", "campaigns", "metrics"]);

function entityList(entity, accountId) {
  if (!accountId || !entitiesWithAccount.has(entity)) {
    return db[entity];
  }
  return db[entity].filter((item) => item.accountId === accountId);
}

function requireAccount(entity, payload, res) {
  if (!entitiesWithAccount.has(entity)) return true;
  if (!payload.accountId) {
    res.status(400).json({ message: "accountId is required" });
    return false;
  }
  const exists = db.accounts.some((acc) => acc.id === payload.accountId);
  if (!exists) {
    res.status(400).json({ message: "accountId does not exist" });
    return false;
  }
  return true;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: now() });
});

// Seed sample data for quick testing (MVP convenience).
// This endpoint is intentionally non-production.
app.post("/api/seed", (req, res) => {
  const { reset } = req.query;
  if (String(reset).toLowerCase() === "true") {
    db.accounts = [];
    db.ideas = [];
    db.posts = [];
    db.campaigns = [];
    db.metrics = [];
    seq = 1;
    commit();
  }

  const accountId = db.accounts.length
    ? db.accounts[0].id
    : (() => {
        const id = nextId();
        db.accounts.push({
          id,
          createdAt: now(),
          updatedAt: now(),
          name: "Demo Account",
          platform: "Instagram",
          niche: "Social Marketing",
        });
        return id;
      })();

  const idea1Id = nextId();
  const idea2Id = nextId();
  const idea3Id = nextId();
  const baseMonth = new Date();
  const isoOf = (d) => d.toISOString();

  db.ideas.push(
    {
      id: idea1Id,
      createdAt: now(),
      updatedAt: now(),
      accountId,
      title: "Offer Reel for New Followers",
      platform: "Instagram",
      type: "video",
      status: "ready",
      viral: 4,
      audienceFit: 4,
      ease: 4,
      score: 4.0,
    },
    {
      id: idea2Id,
      createdAt: now(),
      updatedAt: now(),
      accountId,
      title: "Carousel: 5 Mistakes in Our Niche",
      platform: "Instagram",
      type: "image",
      status: "in-progress",
      viral: 5,
      audienceFit: 3,
      ease: 3,
      score: 4.0,
    },
    {
      id: idea3Id,
      createdAt: now(),
      updatedAt: now(),
      accountId,
      title: "Ad: Limited Time Bundle",
      platform: "Facebook",
      type: "ad",
      status: "ready",
      viral: 3,
      audienceFit: 4,
      ease: 4,
      score: 3.6,
    }
  );

  db.posts.push(
    {
      id: nextId(),
      createdAt: now(),
      updatedAt: now(),
      accountId,
      title: "Reel - Offer Reel for New Followers",
      platform: "Instagram",
      scheduledAt: isoOf(new Date(Date.now() - 2 * 24 * 3600 * 1000)),
      status: "published",
    },
    {
      id: nextId(),
      createdAt: now(),
      updatedAt: now(),
      accountId,
      title: "Carousel - 5 Mistakes",
      platform: "Instagram",
      scheduledAt: isoOf(new Date(Date.now() - 6 * 24 * 3600 * 1000)),
      status: "published",
    },
    {
      id: nextId(),
      createdAt: now(),
      updatedAt: now(),
      accountId,
      title: "Ad - Limited Time Bundle",
      platform: "Facebook",
      scheduledAt: isoOf(new Date(Date.now() - 1 * 24 * 3600 * 1000)),
      status: "published",
    }
  );

  const camp1 = {
    id: nextId(),
    createdAt: now(),
    updatedAt: now(),
    accountId,
    name: "Spring Promo",
    objective: "Leads",
    budget: 150,
    status: "active",
  };
  const camp2 = {
    id: nextId(),
    createdAt: now(),
    updatedAt: now(),
    accountId,
    name: "Awareness Push",
    objective: "Reach",
    budget: 80,
    status: "closed",
  };
  db.campaigns.push(camp1, camp2);

  // 6 months of sample metrics so monthly trend has data.
  for (let i = 0; i < 6; i++) {
    const d = new Date(baseMonth);
    d.setMonth(d.getMonth() - (5 - i));
    const createdAt = isoOf(d);
    const views = 1200 + i * 350;
    const engagement = 90 + i * 22;
    const leads = 6 + i;
    const spend = 30 + i * 12;
    db.metrics.push({
      id: nextId(),
      createdAt,
      updatedAt: now(),
      accountId,
      label: "Monthly Mix",
      views,
      engagement,
      leads,
      spend,
    });
  }

  commit();

  res.json({
    ok: true,
    accountId,
    counts: {
      accounts: db.accounts.length,
      ideas: db.ideas.length,
      posts: db.posts.length,
      campaigns: db.campaigns.length,
      metrics: db.metrics.length,
    },
  });
});

app.get("/api/dashboard", (req, res) => {
  const accountId = req.query.accountId;
  const posts = entityList("posts", accountId);
  const campaigns = entityList("campaigns", accountId);
  const ideas = entityList("ideas", accountId);

  const thisWeekPosts = posts.filter((post) => {
    if (!post.scheduledAt) return false;
    const days = (Date.now() - new Date(post.scheduledAt).getTime()) / (1000 * 3600 * 24);
    return days >= -7 && days <= 7;
  }).length;

  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const readyIdeas = ideas.filter((idea) => idea.status === "ready").length;
  const topIdeas = [...ideas]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5);

  res.json({
    thisWeekPosts,
    activeCampaigns,
    readyIdeas,
    totalAccounts: db.accounts.length,
    topIdeas,
  });
});

app.get("/api/analytics/overview", (req, res) => {
  const accountId = req.query.accountId;
  const metrics = entityList("metrics", accountId);
  const posts = entityList("posts", accountId);
  const ideas = entityList("ideas", accountId);
  const campaigns = entityList("campaigns", accountId);

  const totals = metrics.reduce(
    (acc, m) => {
      acc.views += Number(m.views || 0);
      acc.engagement += Number(m.engagement || 0);
      acc.leads += Number(m.leads || 0);
      acc.spend += Number(m.spend || 0);
      return acc;
    },
    { views: 0, engagement: 0, leads: 0, spend: 0 }
  );

  const monthMap = new Map();
  for (const m of metrics) {
    const key = (m.createdAt || now()).slice(0, 7);
    if (!monthMap.has(key)) {
      monthMap.set(key, { month: key, views: 0, engagement: 0, leads: 0 });
    }
    const row = monthMap.get(key);
    row.views += Number(m.views || 0);
    row.engagement += Number(m.engagement || 0);
    row.leads += Number(m.leads || 0);
  }
  const monthly = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  const byPlatformMap = new Map();
  for (const post of posts) {
    const platform = post.platform || "unknown";
    byPlatformMap.set(platform, (byPlatformMap.get(platform) || 0) + 1);
  }
  const byPlatform = [...byPlatformMap.entries()].map(([platform, count]) => ({
    platform,
    count,
  }));

  const funnel = {
    ideas: ideas.length,
    publishedPosts: posts.filter((p) => p.status === "published").length,
    activeCampaigns: campaigns.filter((c) => c.status === "active").length,
    leads: totals.leads,
  };

  res.json({
    totals,
    monthly,
    byPlatform,
    funnel,
    roi: totals.spend > 0 ? Number((totals.leads / totals.spend).toFixed(2)) : 0,
  });
});

function makeCrudRoutes(entity) {
  app.get(`/api/${entity}`, (req, res) => {
    res.json(entityList(entity, req.query.accountId));
  });

  app.post(`/api/${entity}`, (req, res) => {
    if (!requireAccount(entity, req.body, res)) return;
    const item = {
      id: nextId(),
      createdAt: now(),
      updatedAt: now(),
      ...req.body,
    };
    db[entity].push(item);
    commit();
    res.status(201).json(item);
  });

  app.put(`/api/${entity}/:id`, (req, res) => {
    const idx = db[entity].findIndex((x) => x.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ message: `${entity} item not found` });
    }
    const queryAccountId = req.query.accountId;
    if (entitiesWithAccount.has(entity) && queryAccountId) {
      const existing = db[entity][idx];
      if (existing.accountId !== queryAccountId) {
        return res.status(403).json({ message: "Forbidden for this account" });
      }
    }
    if (entitiesWithAccount.has(entity) && req.body.accountId) {
      const exists = db.accounts.some((acc) => acc.id === req.body.accountId);
      if (!exists) {
        return res.status(400).json({ message: "accountId does not exist" });
      }
    }
    db[entity][idx] = {
      ...db[entity][idx],
      ...req.body,
      updatedAt: now(),
    };
    commit();
    return res.json(db[entity][idx]);
  });

  app.delete(`/api/${entity}/:id`, (req, res) => {
    const idx = db[entity].findIndex((x) => x.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ message: `${entity} item not found` });
    }
    const queryAccountId = req.query.accountId;
    if (entitiesWithAccount.has(entity) && queryAccountId) {
      const existing = db[entity][idx];
      if (existing.accountId !== queryAccountId) {
        return res.status(403).json({ message: "Forbidden for this account" });
      }
    }
    db[entity].splice(idx, 1);
    commit();
    return res.status(204).send();
  });
}

["accounts", "ideas", "posts", "campaigns", "metrics"].forEach(makeCrudRoutes);

// Vercel expects an Express app export (single serverless function).
// Local dev still uses `app.listen` when run directly, but we disable listening on Vercel.
const runningOnVercel = !!process.env.VERCEL;

if (require.main === module && !runningOnVercel) {
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
