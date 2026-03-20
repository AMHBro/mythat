<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";

// Prefer a deployed backend URL on production (e.g. Vercel env var).
// Example: VITE_API_BASE_URL="https://your-backend-host/api"
const API =
  import.meta.env.VITE_API_BASE_URL || "/api";

const accounts = ref([]);
const ideas = ref([]);
const posts = ref([]);
const campaigns = ref([]);
const metrics = ref([]);
const dashboard = ref(null);
const analytics = ref(null);
const activeTab = ref("dashboard");
const loading = ref(false);
const error = ref("");
const selectedAccountId = ref("");

const tabLabels = {
  dashboard: "لوحة التحكم",
  analytics: "التحليل",
  accounts: "الحسابات",
  ideas: "الأفكار",
  posts: "المحتوى",
  campaigns: "الحملات",
  metrics: "النتائج",
};

const accountForm = reactive({ name: "", platform: "", niche: "" });
const ideaForm = reactive({
  accountId: "",
  title: "",
  platform: "",
  type: "video",
  status: "idea",
  viral: 3,
  audienceFit: 3,
  ease: 3,
});
const postForm = reactive({
  accountId: "",
  title: "",
  platform: "",
  scheduledAt: "",
  status: "scheduled",
});
const campaignForm = reactive({
  accountId: "",
  name: "",
  objective: "",
  budget: 0,
  status: "active",
});
const metricForm = reactive({
  accountId: "",
  label: "",
  views: 0,
  engagement: 0,
  leads: 0,
  spend: 0,
});

const topIdeas = computed(() =>
  [...ideas.value].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5)
);

const chartLinePoints = computed(() => {
  const series = analytics.value?.monthly || [];
  if (!series.length) return "";
  const max = Math.max(...series.map((s) => Number(s.views || 0)), 1);
  return series
    .map((s, i) => {
      const x = 20 + i * (260 / Math.max(series.length - 1, 1));
      const y = 150 - (Number(s.views || 0) / max) * 120;
      return `${x},${y}`;
    })
    .join(" ");
});

const chartBars = computed(() => {
  const list = analytics.value?.byPlatform || [];
  const max = Math.max(...list.map((s) => Number(s.count || 0)), 1);
  return list.map((item, i) => {
    const barHeight = (Number(item.count || 0) / max) * 110;
    return {
      platform: item.platform,
      count: item.count,
      x: 20 + i * 72,
      y: 140 - barHeight,
      h: barHeight,
    };
  });
});

function calculateIdeaScore() {
  return Number(
    (
      ideaForm.viral * 0.4 +
      ideaForm.audienceFit * 0.4 +
      ideaForm.ease * 0.2
    ).toFixed(2)
  );
}

function accountQuery() {
  return selectedAccountId.value ? `?accountId=${selectedAccountId.value}` : "";
}

function withSelectedAccount(path) {
  const query = accountQuery();
  return query ? `${path}${query}` : path;
}

function accountNameById(id) {
  return accounts.value.find((a) => a.id === id)?.name || "غير معروف";
}

function postStatusLabel(status) {
  if (status === "scheduled") return "مجدول";
  if (status === "published") return "منشور";
  return status || "";
}

function campaignStatusLabel(status) {
  if (status === "active") return "نشطة";
  if (status === "closed") return "مقفلة";
  return status || "";
}

async function deleteItem(entity, id) {
  if (!confirm("هل أنت متأكد من الحذف؟")) return;
  await request(withSelectedAccount(`/${entity}/${id}`), { method: "DELETE" });
  await loadAll();
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Request failed");
  }
  if (response.status === 204) return null;
  return response.json();
}

async function loadAll() {
  loading.value = true;
  error.value = "";
  try {
    const acc = await request("/accounts");
    accounts.value = acc;

    if (!selectedAccountId.value && accounts.value.length) {
      selectedAccountId.value = accounts.value[0].id;
    }

    const [dash, id, ps, cp, mt, an] = await Promise.all([
      request(withSelectedAccount("/dashboard")),
      request(withSelectedAccount("/ideas")),
      request(withSelectedAccount("/posts")),
      request(withSelectedAccount("/campaigns")),
      request(withSelectedAccount("/metrics")),
      request(withSelectedAccount("/analytics/overview")),
    ]);

    dashboard.value = dash;
    ideas.value = id;
    posts.value = ps;
    campaigns.value = cp;
    metrics.value = mt;
    analytics.value = an;
  } catch (e) {
    error.value =
      "تعذر تحميل البيانات. تأكد أن الـ API يعمل وأن `VITE_API_BASE_URL` مضبوط (إن كنت على Vercel).";
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function addAccount() {
  const created = await request("/accounts", {
    method: "POST",
    body: JSON.stringify(accountForm),
  });
  accountForm.name = "";
  accountForm.platform = "";
  accountForm.niche = "";
  selectedAccountId.value = created.id;
  await loadAll();
}

async function addIdea() {
  await request("/ideas", {
    method: "POST",
    body: JSON.stringify({
      ...ideaForm,
      accountId: ideaForm.accountId || selectedAccountId.value,
      score: calculateIdeaScore(),
    }),
  });
  ideaForm.title = "";
  ideaForm.platform = "";
  ideaForm.type = "video";
  ideaForm.status = "idea";
  ideaForm.viral = 3;
  ideaForm.audienceFit = 3;
  ideaForm.ease = 3;
  await loadAll();
}

async function addPost() {
  await request("/posts", {
    method: "POST",
    body: JSON.stringify({
      ...postForm,
      accountId: postForm.accountId || selectedAccountId.value,
    }),
  });
  postForm.title = "";
  postForm.platform = "";
  postForm.scheduledAt = "";
  postForm.status = "scheduled";
  await loadAll();
}

async function addCampaign() {
  await request("/campaigns", {
    method: "POST",
    body: JSON.stringify({
      ...campaignForm,
      accountId: campaignForm.accountId || selectedAccountId.value,
    }),
  });
  campaignForm.name = "";
  campaignForm.objective = "";
  campaignForm.budget = 0;
  campaignForm.status = "active";
  await loadAll();
}

async function addMetric() {
  await request("/metrics", {
    method: "POST",
    body: JSON.stringify({
      ...metricForm,
      accountId: metricForm.accountId || selectedAccountId.value,
    }),
  });
  metricForm.label = "";
  metricForm.views = 0;
  metricForm.engagement = 0;
  metricForm.leads = 0;
  metricForm.spend = 0;
  await loadAll();
}

async function addSeed() {
  await request("/seed?reset=true", {
    method: "POST",
    body: JSON.stringify({}),
  });
  await loadAll();
}

watch(selectedAccountId, async () => {
  await loadAll();
});

onMounted(loadAll);
</script>

<template>
  <div class="app" dir="rtl">
    <header class="header">
      <h1>نظام إدارة السوشال ميديا</h1>
      <p>ربط كامل بين الأقسام + تحليل ورسوم بيانية حسب كل حساب.</p>
    </header>

    <section class="toolbar panel">
      <label>
        الحساب الحالي
        <select v-model="selectedAccountId">
          <option value="">كل الحسابات</option>
          <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
        </select>
      </label>
      <button class="seed-btn" type="button" @click="addSeed">
        إدخال بيانات تجريبية
      </button>
    </section>

    <nav class="tabs">
      <button v-for="tab in ['dashboard', 'analytics', 'accounts', 'ideas', 'posts', 'campaigns', 'metrics']" :key="tab"
        :class="{ active: activeTab === tab }" @click="activeTab = tab">
        {{ tabLabels[tab] }}
      </button>
    </nav>

    <p v-if="loading">Loading...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <section v-if="activeTab === 'dashboard' && dashboard" class="grid">
      <article class="card">
        <h3>منشورات هذا الأسبوع</h3>
        <strong>{{ dashboard.thisWeekPosts }}</strong>
      </article>
      <article class="card">
        <h3>حملات نشطة</h3>
        <strong>{{ dashboard.activeCampaigns }}</strong>
      </article>
      <article class="card">
        <h3>أفكار جاهزة</h3>
        <strong>{{ dashboard.readyIdeas }}</strong>
      </article>
      <article class="card">
        <h3>عدد الحسابات</h3>
        <strong>{{ dashboard.totalAccounts }}</strong>
      </article>
      <article class="card span-2">
        <h3>أفضل الأفكار حسب الدرجة</h3>
        <ul>
          <li v-for="idea in topIdeas" :key="idea.id">
            {{ idea.title }} ({{ accountNameById(idea.accountId) }}) - {{ idea.score }}
          </li>
        </ul>
      </article>
    </section>

    <section v-if="activeTab === 'analytics' && analytics" class="grid">
      <article class="card">
        <h3>إجمالي المشاهدات</h3>
        <strong>{{ analytics.totals.views }}</strong>
      </article>
      <article class="card">
        <h3>إجمالي التفاعل</h3>
        <strong>{{ analytics.totals.engagement }}</strong>
      </article>
      <article class="card">
        <h3>إجمالي العملاء المحتملين (Leads)</h3>
        <strong>{{ analytics.totals.leads }}</strong>
      </article>
      <article class="card">
        <h3>العائد على الإنفاق (ROI)</h3>
        <strong>{{ analytics.roi }}</strong>
      </article>

      <article class="card span-2">
        <h3>اتجاه المشاهدات شهريًا</h3>
        <svg width="300" height="160" viewBox="0 0 300 160" class="chart">
          <polyline fill="none" stroke="#2563eb" stroke-width="3" :points="chartLinePoints" />
          <line x1="20" y1="140" x2="280" y2="140" stroke="#d1d5db" />
        </svg>
      </article>

      <article class="card span-2">
        <h3>عدد المنشورات حسب المنصة</h3>
        <svg width="300" height="170" viewBox="0 0 300 170" class="chart">
          <line x1="20" y1="140" x2="280" y2="140" stroke="#d1d5db" />
          <g v-for="bar in chartBars" :key="bar.platform">
            <rect :x="bar.x" :y="bar.y" width="36" :height="bar.h" fill="#10b981" rx="4" />
            <text :x="bar.x + 18" y="155" text-anchor="middle" class="chart-label">{{ bar.platform }}</text>
          </g>
        </svg>
      </article>

      <article class="card span-2">
        <h3>مسار التحويل (Funnel)</h3>
        <p>
          الأفكار: {{ analytics.funnel.ideas }} →
          المنشورات المنشورة: {{ analytics.funnel.publishedPosts }} →
          الحملات النشطة: {{ analytics.funnel.activeCampaigns }} →
          Leads: {{ analytics.funnel.leads }}
        </p>
      </article>
    </section>

    <section v-if="activeTab === 'accounts'" class="panel">
      <h2>الحسابات</h2>
      <form @submit.prevent="addAccount" class="form">
        <input v-model="accountForm.name" placeholder="اسم الحساب" required />
        <input v-model="accountForm.platform" placeholder="المنصة" required />
        <input v-model="accountForm.niche" placeholder="مجال النشاط" />
        <button type="submit">إضافة حساب</button>
      </form>
      <ul>
        <li v-for="item in accounts" :key="item.id" class="list-row">
          <span>{{ item.name }} - {{ item.platform }} - {{ item.niche }}</span>
          <button class="danger-btn" type="button" @click="deleteItem('accounts', item.id)">
            حذف
          </button>
        </li>
      </ul>
    </section>

    <section v-if="activeTab === 'ideas'" class="panel">
      <h2>الأفكار</h2>
      <form @submit.prevent="addIdea" class="form">
        <select v-model="ideaForm.accountId" required>
          <option value="" disabled>اختر الحساب</option>
          <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
        </select>
        <input v-model="ideaForm.title" placeholder="عنوان الفكرة" required />
        <input v-model="ideaForm.platform" placeholder="المنصة" required />
        <select v-model="ideaForm.type">
          <option value="video">فيديو</option>
          <option value="image">صورة</option>
          <option value="ad">إعلان</option>
        </select>
        <select v-model="ideaForm.status">
          <option value="idea">فكرة</option>
          <option value="in-progress">قيد التنفيذ</option>
          <option value="ready">جاهزة</option>
        </select>
        <label>قابلية الانتشار (Viral)
          <input v-model.number="ideaForm.viral" type="number" min="1" max="5" />
        </label>
        <label>ملاءمة الجمهور (Audience Fit)
          <input v-model.number="ideaForm.audienceFit" type="number" min="1" max="5" />
        </label>
        <label>سهولة التنفيذ (Ease)
          <input v-model.number="ideaForm.ease" type="number" min="1" max="5" />
        </label>
        <button type="submit">
          إضافة فكرة (الدرجة: {{ calculateIdeaScore() }})
        </button>
      </form>
      <ul>
        <li v-for="item in ideas" :key="item.id" class="list-row">
          <span>
          {{ item.title }} - {{ accountNameById(item.accountId) }} - الدرجة: {{ item.score }}
          </span>
          <button class="danger-btn" type="button" @click="deleteItem('ideas', item.id)">
            حذف
          </button>
        </li>
      </ul>
    </section>

    <section v-if="activeTab === 'posts'" class="panel">
      <h2>المحتوى</h2>
      <form @submit.prevent="addPost" class="form">
        <select v-model="postForm.accountId" required>
          <option value="" disabled>اختر الحساب</option>
          <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
        </select>
        <input v-model="postForm.title" placeholder="عنوان المنشور" required />
        <input v-model="postForm.platform" placeholder="المنصة" required />
        <input v-model="postForm.scheduledAt" type="datetime-local" required />
        <select v-model="postForm.status">
          <option value="scheduled">مجدول</option>
          <option value="published">منشور</option>
        </select>
        <button type="submit">إضافة منشور</button>
      </form>
      <ul>
        <li v-for="item in posts" :key="item.id" class="list-row">
          <span>
            {{ item.title }} - {{ accountNameById(item.accountId) }} - {{ postStatusLabel(item.status) }}
          </span>
          <button class="danger-btn" type="button" @click="deleteItem('posts', item.id)">
            حذف
          </button>
        </li>
      </ul>
    </section>

    <section v-if="activeTab === 'campaigns'" class="panel">
      <h2>الحملات</h2>
      <form @submit.prevent="addCampaign" class="form">
        <select v-model="campaignForm.accountId" required>
          <option value="" disabled>اختر الحساب</option>
          <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
        </select>
        <input v-model="campaignForm.name" placeholder="اسم الحملة" required />
        <input v-model="campaignForm.objective" placeholder="الهدف" required />
        <input v-model.number="campaignForm.budget" type="number" min="0" placeholder="الميزانية" />
        <select v-model="campaignForm.status">
          <option value="active">نشطة</option>
          <option value="closed">مقفلة</option>
        </select>
        <button type="submit">إضافة حملة</button>
      </form>
      <ul>
        <li v-for="item in campaigns" :key="item.id" class="list-row">
          <span>
            {{ item.name }} - {{ accountNameById(item.accountId) }} - {{ campaignStatusLabel(item.status) }} - ${{ item.budget }}
          </span>
          <button class="danger-btn" type="button" @click="deleteItem('campaigns', item.id)">
            حذف
          </button>
        </li>
      </ul>
    </section>

    <section v-if="activeTab === 'metrics'" class="panel">
      <h2>النتائج والتحليل</h2>
      <form @submit.prevent="addMetric" class="form">
        <select v-model="metricForm.accountId" required>
          <option value="" disabled>اختر الحساب</option>
          <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
        </select>
        <input v-model="metricForm.label" placeholder="وسم المنشور/الحملة" required />
        <input v-model.number="metricForm.views" type="number" min="0" placeholder="المشاهدات" />
        <input v-model.number="metricForm.engagement" type="number" min="0" placeholder="التفاعل" />
        <input v-model.number="metricForm.leads" type="number" min="0" placeholder="Leads" />
        <input v-model.number="metricForm.spend" type="number" min="0" placeholder="الإنفاق" />
        <button type="submit">إضافة نتيجة</button>
      </form>
      <ul>
        <li v-for="item in metrics" :key="item.id" class="list-row">
          <span>
            {{ item.label }} - {{ accountNameById(item.accountId) }} - المشاهدات: {{ item.views }} - Leads: {{ item.leads }}
          </span>
          <button class="danger-btn" type="button" @click="deleteItem('metrics', item.id)">
            حذف
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
