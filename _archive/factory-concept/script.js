// JUNSEO WORKS — top-down production lines + KO/EN toggle
// Korean static strings live in the HTML; English lives in EN below.
// Each featured project renders as its own production line: stations on the
// belt are the actual techniques (with why), ending at a QC gate and a
// shipped-outcome dock. Everything is visible without interaction.

const FEATURED = [
  {
    id: "team18",
    name: "Team18_BE",
    url: "https://github.com/kakao-tech-campus-3rd-step3/Team18_BE",
    stack: "Java · Spring Boot · MySQL · Redis",
    role: { ko: "3인 팀 · 지원서 도메인", en: "3-PERSON TEAM · APPLICATIONS DOMAIN" },
    intro: {
      ko: "대학 동아리 모집·지원자 관리 서비스 — 카카오테크캠퍼스에서 9개월간 만들어 실서비스로 운영했습니다. 지원서 도메인의 API 설계·DB 모델링을 맡았고 통계·공지·이메일 알림은 처음부터 끝까지 구현했습니다.",
      en: "University club recruiting & applicant management service — built and operated as a live service over 9 months at Kakao Tech Campus. I owned the application domain's API design and DB model, and built statistics, announcements, and email notifications end to end.",
    },
    stations: [
      {
        t: { ko: "도메인 API 설계 · DB 모델링", en: "Domain API design · DB modeling" },
        why: {
          ko: "지원서 제출 도메인을 맡아 API 계약과 스키마를 먼저 고정 — 3인 팀이 병렬로 움직일 기준선.",
          en: "Owned the application domain: API contract and schema fixed first — the baseline that let a 3-person team work in parallel.",
        },
      },
      {
        t: { ko: "이벤트 기반 비동기 이메일", en: "Event-driven async email" },
        why: {
          ko: "발송 지연이 사용자 응답을 막지 않도록 이벤트로 분리. 실패는 재시도 가능/불가로 분류해 대응.",
          en: "Decoupled via events so slow delivery never blocks the user's request; failures classified retryable vs. not.",
        },
      },
      {
        t: { ko: "join fetch · 프로젝션", en: "join fetch · projections" },
        why: {
          ko: "지원서 목록 조회의 N+1과 불필요한 컬럼 로딩을 제거해 쿼리 수를 감축.",
          en: "Killed N+1 and needless column loads on applicant-list reads, cutting query counts.",
        },
      },
      {
        t: { ko: "Prometheus · Grafana · Loki", en: "Prometheus · Grafana · Loki" },
        why: {
          ko: "스택 구축은 팀 공동 작업 — 그 위에 비즈니스 지표를 등록하고 Discord 알림까지 연결해 장애를 지표·로그로 추적.",
          en: "Stack built jointly by the team — business metrics registered on top and wired through to Discord alerts, so incidents are traced via metrics and logs.",
        },
      },
      {
        qc: true,
        t: { ko: "계층별 테스트 290개", en: "290 layered tests" },
        why: {
          ko: "9개월 운영 중 기능 추가·리팩터링의 회귀를 막는 안전망. 계층 분리로 실패 지점을 즉시 특정.",
          en: "The regression net across 9 months of operation; layering pinpoints exactly where a failure lives.",
        },
      },
    ],
    outcome: {
      ko: ["9개월 실서비스 운영", "3인 팀 협업", "카카오테크캠퍼스"],
      en: ["9 months in production", "3-person team", "Kakao Tech Campus"],
    },
    evidence: [
      { label: { ko: "CI 워크플로", en: "CI workflow" }, url: "https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/blob/develop/.github/workflows/ci-on-pr.yml" },
      { label: { ko: "모니터링 구성", en: "Monitoring config" }, url: "https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/tree/develop/monitoring" },
      { label: { ko: "docker-compose.monitoring.yml", en: "docker-compose.monitoring.yml" }, url: "https://github.com/kakao-tech-campus-3rd-step3/Team18_BE/blob/develop/docker-compose.monitoring.yml" },
    ],
  },
  {
    id: "study-helper",
    name: "study-helper-backend",
    url: "https://github.com/gary5876/study-helper-backend",
    stack: "Python · FastAPI · PostgreSQL · Redis",
    role: { ko: "솔로 · 설계 → 배포 전 과정", en: "SOLO · DESIGN → DEPLOY" },
    intro: {
      ko: "PDF를 올리면 LLM으로 학습 노트·퀴즈를 만들어주는 API. 외부 LLM API 3사(Claude·GPT·TimelyGPT)를 연동했고, 설계부터 CI·클라우드 배포까지 혼자 구성했습니다.",
      en: "An API that turns uploaded PDFs into study notes and quizzes with LLMs. Three providers integrated (Claude · GPT · TimelyGPT); designed, built, and deployed solo, CI included.",
    },
    stations: [
      {
        t: { ko: "서킷 브레이커 (직접 구현)", en: "Circuit breaker (hand-rolled)" },
        why: {
          ko: "한 LLM사의 장애가 서비스 전체로 번지지 않게 격리. 사용자 키 오류(401)는 장애로 세지 않아 오작동 차단 방지.",
          en: "Isolates one provider's outage from the whole service; user key errors (401) don't count as failures, so they never falsely trip it.",
        },
      },
      {
        t: { ko: "SHA-256 해시 캐싱", en: "SHA-256 hash caching" },
        why: {
          ko: "같은 PDF가 다시 오면 LLM을 아예 호출하지 않음 — API 비용과 대기 시간을 동시에 제거.",
          en: "Re-uploaded PDFs skip the LLM entirely — cutting API cost and wait time at once.",
        },
      },
      {
        t: { ko: "응답 검증 파이프라인", en: "Response validation pipeline" },
        why: {
          ko: "LLM 출력을 그대로 믿지 않음 — 중복 제거·환각 탐지·필드 보정을 통과한 것만 저장.",
          en: "LLM output is never trusted as-is: only content passing dedup, hallucination detection, and field repair is stored.",
        },
      },
      {
        t: { ko: "GitHub Actions OIDC 키리스 배포", en: "GitHub Actions OIDC keyless deploy" },
        why: {
          ko: "장기 클라우드 자격증명을 저장소에 두지 않음 — 유출돼도 훔칠 시크릿이 없는 구조.",
          en: "No long-lived cloud credentials anywhere in the repo — there is simply no secret to steal.",
        },
      },
      {
        qc: true,
        t: { ko: "테스트 280개 · 레이트리밋 · 메트릭", en: "280 tests · rate limit · metrics" },
        why: {
          ko: "혼자 운영하는 서비스 — 비용 폭주와 이상 징후는 사람이 아니라 기계가 잡아야 함.",
          en: "A solo-operated service: cost spikes and anomalies must be caught by machinery, not by me watching.",
        },
      },
    ],
    outcome: {
      ko: ["AWS 운영 배포", "LLM 3사 연동", "솔로 풀사이클"],
      en: ["Deployed on AWS", "3 LLM providers", "Solo full-cycle"],
    },
    evidence: [
      { label: { ko: "배포 워크플로 (OIDC)", en: "Deploy workflow (OIDC)" }, url: "https://github.com/gary5876/study-helper-backend/blob/develop/.github/workflows/deploy.yml" },
      { label: { ko: "deploy/ 구성", en: "deploy/ setup" }, url: "https://github.com/gary5876/study-helper-backend/tree/develop/deploy" },
      { label: { ko: "테스트 스위트", en: "Test suite" }, url: "https://github.com/gary5876/study-helper-backend/tree/develop/tests" },
    ],
    incident: {
      id: "INCIDENT #2026-04-15",
      title: { ko: "세션 영구 pending 버그", en: "Sessions stuck in pending forever" },
      symptom: {
        ko: "생성이 끝난 세션이 대시보드에서 계속 '생성 중'으로 남고 재진입 불가.",
        en: "Finished sessions stayed \"generating\" on the dashboard and could not be re-entered.",
      },
      cause: {
        ko: "상태 동기화 함수가 예외와 0-row 매치를 조용히 삼켜 메모리 'complete' vs DB 'pending' 불일치가 영구화.",
        en: "The status-sync silently swallowed exceptions and 0-row matches, making the memory-complete vs. DB-pending mismatch permanent.",
      },
      fix: {
        ko: "8개 가설을 검증해 원인 확정 → 동기화 실패를 명시적 실패로 전이, 재업로드 시 상태 다운그레이드 차단, 메모리 유실 대비 DB fallback 경로 추가.",
        en: "Eight hypotheses tested to confirm the cause → sync failures now transition to explicit failed state, re-uploads can no longer downgrade status, and a DB fallback path survives memory loss.",
      },
      url: "https://github.com/gary5876/study-helper-backend#readme",
    },
  },
  {
    id: "vgc-ai",
    name: "vgc-ai",
    url: "https://github.com/gary5876/vgc-ai",
    stack: "Python 3.12 · uv · pytest · mypy",
    role: { ko: "솔로 · 실험 파이프라인", en: "SOLO · EXPERIMENT PIPELINE" },
    intro: {
      ko: "IEEE CoG 2026 포켓몬 VGC AI 대회를 준비 중인 게임 AI. 에이전트 자체보다 '개선을 어떻게 검증하는가'를 보여주는 프로젝트입니다 — 코딩 에이전트를 개발에 투입하되, 통계 게이트를 통과한 것만 받습니다.",
      en: "Game AI targeting the IEEE CoG 2026 Pokémon VGC AI competition. The point is less the agent than how improvements are verified — coding agents join the work, but only what passes the statistical gate is accepted.",
    },
    stations: [
      {
        t: { ko: "휴리스틱 탐색 (deep RL 기각)", en: "Heuristic search (deep RL rejected)" },
        why: {
          ko: "이 엔진은 분산이 커서 deep RL이 깨진다는 선행 대회 분석 — 고전 탐색 + 평가 함수가 실제로 더 강함.",
          en: "Prior-competition analysis showed the engine's variance breaks deep RL — classical search with a crafted eval simply wins more.",
        },
      },
      {
        t: { ko: "LP-minimax 팀빌딩", en: "LP-minimax team building" },
        why: {
          ko: "상대 메타가 무엇이든 최악의 매치업을 수학적으로 보장하는 팀 선택.",
          en: "Team selection with a mathematically guaranteed worst case, whatever the opposing meta.",
        },
      },
      {
        t: { ko: "코딩 에이전트 전략 제안", en: "Coding-agent strategy proposals" },
        why: {
          ko: "GCP VM에서 에이전트가 전략을 제안 — 사람이 못 도는 탐색 폭을 확장하되, 채택은 게이트가 결정.",
          en: "Agents on a GCP VM propose strategies — widening the search beyond human hours, while adoption is decided by the gate.",
        },
      },
      {
        qc: true,
        t: { ko: "n=2000 자가대전 · 95% CI 게이트", en: "n=2000 self-play · 95% CI gate" },
        why: {
          ko: "신뢰구간 하한을 통과해야만 채택 — 우연한 연승을 개선으로 착각하지 않기 위해. 기각된 실험도 원인 분석과 함께 보존.",
          en: "Adopted only past the CI lower bound — so lucky streaks are never mistaken for improvements. Rejected experiments kept with root-cause notes.",
        },
      },
    ],
    outcome: {
      ko: ["교내 리그전 1위 / 25명", "IEEE CoG 2026 준비 중"],
      en: ["1st of 25, class league", "Prepping IEEE CoG 2026"],
    },
    evidence: [
      { label: { ko: "selection.py — 기각 실험 기록", en: "selection.py — rejected experiments" }, url: "https://github.com/gary5876/vgc-ai/blob/main/src/vgc_ai/policies/selection.py" },
      { label: { ko: "리그전 결과 (README)", en: "League results (README)" }, url: "https://github.com/gary5876/vgc-ai#results" },
    ],
  },
];

const MINIS = [
  {
    name: "shipchajang",
    url: "https://github.com/gary5876/shipchajang",
    labels: ["FastAPI", "Spec-first", "Cloud Run"],
    desc: {
      ko: "무단주차 감지·알림 시스템. 엣지 카메라 → 번호판 인식 → 위반 판정 → 증거 기반 푸시. 외부 자원은 seam 뒤에 두어 하드웨어 없이 전 구간 테스트, Cloud Run scale-to-zero로 고정비 최소화.",
      en: "Unauthorized-parking detection: edge camera → plate recognition → violation engine → evidence-backed push. External resources behind seams (full pipeline testable with no hardware); Cloud Run scale-to-zero keeps fixed costs near zero.",
    },
  },
  {
    name: "rag-survey-notes",
    url: "https://github.com/gary5876/rag-survey-notes",
    labels: ["RAG", "Paper deep-read"],
    desc: {
      ko: "RAG 서베이 논문(arXiv:2312.10997)을 원문으로 정독하고 정리 — Naive → Advanced → Modular RAG 흐름과 '언제 도입할 가치가 있는가'의 판단 기준. study-helper LLM 파이프라인의 의사결정 근거로 사용.",
      en: "The RAG survey (arXiv:2312.10997) read in full and restructured — the Naive → Advanced → Modular progression and when each is worth adopting. Used as decision input for the study-helper LLM pipeline.",
    },
  },
  {
    name: "capstone-dsc",
    url: "https://github.com/gary5876/capstone-dsc",
    labels: ["ML", "Experiment design"],
    desc: {
      ko: "데이터 품질 점수가 ML 성능을 예측하는지 실증한 캡스톤 — 3개 데이터셋 × 5종 오염 주입 × 5개 모델. 단일 조건 결론은 일반화되지 않으므로 격자 전체에서 검증.",
      en: "Capstone testing whether a data-quality score predicts ML performance — 3 datasets × 5 corruption types × 5 models. Single-condition conclusions don't generalize, so the claim was tested across the grid.",
    },
  },
];

// English for static (data-i18n) strings; Korean is captured from the DOM.
const EN = {
  nav_line: "Production Line",
  nav_machinery: "Machinery",
  nav_qc: "QC Certs",
  nav_operator: "Operator",
  hero_kicker: "IN OPERATION · 570+ TESTS · POSTMORTEMS ON RECORD",
  hero_contact: "Contact ✉",
  hero_title: "JUNSEO'S BACKEND FACTORY",
  hero_sub:
    "Built and operated a team service with Java & Spring; shipped solo services with Python & " +
    "FastAPI. These days I experiment with putting coding agents on the production line. This " +
    "factory has one rule — every shipment must pass the verification gate: 570+ layered tests, " +
    "n=2000 benchmark confidence intervals, and human code review.",
  hero_cta: "View the line ↓",
  line_title: "PRODUCTION LINE",
  line_note:
    "Each product has its own line — every station on the belt names a technique and why it was " +
    "used, and the dock at the end shows what actually shipped.",
  also_title: "SMALLER CRATES · ALSO SHIPPED",
  machinery_title: "MACHINERY",
  machinery_note: "3 units running around the clock",
  unit_be:
    "From domain API design and DB modeling to async event handling, query optimization " +
    "(join fetch, projections), and layered testing — 290 tests on a Spring Boot team project, " +
    "280 on a solo FastAPI service.",
  unit_do:
    "Helped build a Prometheus · Grafana · Loki monitoring stack and wired business metrics " +
    "to Discord alerts. Deployed via GitHub Actions CI/CD to AWS (EC2 · ECR · SSM with keyless " +
    "OIDC) and GCP (Cloud Run · Cloud SQL). Not done yet — IaC like Terraform, zero-downtime " +
    "deploys. Next on the list.",
  unit_llm:
    "Integrated three external LLM APIs with hand-rolled circuit breakers, exponential backoff, " +
    "hash caching, and response validation (dedup, hallucination detection). I also run an " +
    "experiment pipeline that gates coding-agent proposals on the 95% CI of an n=2000 benchmark.",
  qc_title: "QC CERTIFICATES",
  qc_note: "Verified by external authorities",
  stamp_certified: "CERTIFIED",
  stamp_completed: "COMPLETED",
  stamp_completed2: "COMPLETED",
  cert_aws_ai: "Earned Aug 2026 · valid through Aug 2029",
  cert_aws_cp: "AWS official training completed · Aug 2026",
  cert_ktc_t: "Kakao Tech Campus — Backend Track",
  cert_ktc: "Staged code-review missions + 9-month team project",
  op_title: "OPERATOR",
  op_note: "Plant manager & sole operator",
  op_role: "BACKEND ENGINEER · SCHOOL OF AI",
  op_bio:
    "Completed the Kakao Tech Campus backend track. I worked through the spring-gift missions with " +
    "stage-by-stage code review, which led into the Team18_BE team project. My current interest is " +
    "not \"development that trusts AI\" but \"development that verifies AI\" — building workflows " +
    "where a coding agent's output is accepted only after passing tests, benchmarks, and " +
    "statistical gates.",
  op_contact: "Hiring inquiries",
  footer_note: "This factory was built by hand — plain HTML · CSS · JS, no build tools.",
};

// Chrome strings for rendered (non-data-i18n) fragments.
const CHROME = {
  ko: {
    step: "공정", qc: "품질 게이트", dock: "출하 기록 · OUTBOUND", stamp: "출하 완료", repo: "레포 ↗",
    evidence: "증빙 · EVIDENCE",
    inc_symptom: "증상", inc_cause: "원인", inc_fix: "조치", inc_link: "전체 기록 (README) ↗",
  },
  en: {
    step: "STEP", qc: "QC GATE", dock: "OUTBOUND", stamp: "SHIPPED", repo: "REPO ↗",
    evidence: "EVIDENCE",
    inc_symptom: "SYMPTOM", inc_cause: "CAUSE", inc_fix: "FIX", inc_link: "Full record (README) ↗",
  },
};

const i18nNodes = document.querySelectorAll("[data-i18n]");
const KO = {};
i18nNodes.forEach((el) => { KO[el.dataset.i18n] = el.innerHTML; });

let lang = localStorage.getItem("lang") || "ko";

const toggle = document.getElementById("lang-toggle");
const linesEl = document.getElementById("lines");
const minisEl = document.getElementById("minis");

function pad(n) { return String(n).padStart(2, "0"); }

// ----- production lines -----
function renderLines() {
  const c = CHROME[lang];
  linesEl.innerHTML = FEATURED.map((p, i) => {
    const stations = p.stations
      .map((s, j) => {
        const stepLabel = s.qc ? c.qc : c.step + " " + pad(j + 1);
        const title = s.qc ? "<span>" + s.t[lang] + "</span>" : s.t[lang];
        return (
          '<div class="station' + (s.qc ? " station-qc" : "") + '">' +
          '<span class="station-step">' + stepLabel + "</span>" +
          '<span class="station-t">' + title + "</span>" +
          '<span class="station-why">' + s.why[lang] + "</span>" +
          "</div>"
        );
      })
      .join("");
    const outcome = p.outcome[lang].map((o) => "✓ " + o).join("<br>");
    const evidence = p.evidence
      ? '<p class="line-evidence"><span class="line-evidence-label">' + c.evidence + "</span>" +
        p.evidence
          .map((e) => '<a href="' + e.url + '" target="_blank" rel="noopener">' + e.label[lang] + " ↗</a>")
          .join("") +
        "</p>"
      : "";
    const incident = p.incident
      ? '<aside class="incident">' +
        '<header class="incident-head"><span class="incident-id">' + p.incident.id + "</span>" +
        '<span class="incident-title">' + p.incident.title[lang] + "</span></header>" +
        '<dl class="incident-body">' +
        "<dt>" + c.inc_symptom + "</dt><dd>" + p.incident.symptom[lang] + "</dd>" +
        "<dt>" + c.inc_cause + "</dt><dd>" + p.incident.cause[lang] + "</dd>" +
        "<dt>" + c.inc_fix + "</dt><dd>" + p.incident.fix[lang] + "</dd>" +
        "</dl>" +
        '<a class="incident-link" href="' + p.incident.url + '" target="_blank" rel="noopener">' + c.inc_link + "</a>" +
        "</aside>"
      : "";
    return (
      '<article class="line">' +
      '<header class="line-head">' +
      '<span class="line-no">LINE ' + pad(i + 1) + "</span>" +
      '<h3 class="line-name"><a href="' + p.url + '" target="_blank" rel="noopener">' + p.name + "</a></h3>" +
      '<span class="line-role">' + p.role[lang] + "</span>" +
      '<span class="line-stack">' + p.stack + "</span>" +
      '<a class="line-repo" href="' + p.url + '" target="_blank" rel="noopener">' + c.repo + "</a>" +
      "</header>" +
      '<p class="line-intro">' + p.intro[lang] + "</p>" +
      '<div class="line-belt">' +
      '<div class="belt-inner">' +
      stations +
      '<div class="dock">' +
      '<span class="dock-label">' + c.dock + "</span>" +
      '<span class="dock-stamp">' + c.stamp + "</span>" +
      '<span class="dock-outcome">' + outcome + "</span>" +
      "</div>" +
      '<span class="runner" aria-hidden="true"></span>' +
      "</div>" +
      "</div>" +
      incident +
      evidence +
      "</article>"
    );
  }).join("");
}

function renderMinis() {
  minisEl.innerHTML = MINIS.map(
    (m) =>
      '<a class="mini" href="' + m.url + '" target="_blank" rel="noopener">' +
      '<span class="mini-name">' + m.name + "</span>" +
      '<span class="mini-desc">' + m.desc[lang] + "</span>" +
      '<span class="mini-labels">' +
      m.labels.map((l) => "<span>" + l + "</span>").join("") +
      "</span>" +
      "</a>"
  ).join("");
}

// ----- language toggle -----
function applyLang(newLang) {
  lang = newLang;
  const dict = lang === "ko" ? KO : EN;
  i18nNodes.forEach((el) => {
    const val = dict[el.dataset.i18n];
    if (val !== undefined) el.innerHTML = val;
  });
  document.documentElement.lang = lang;
  toggle.dataset.lang = lang;
  localStorage.setItem("lang", lang);
  renderLines();
  renderMinis();
}

toggle.addEventListener("click", () => applyLang(lang === "ko" ? "en" : "ko"));

applyLang(lang);
