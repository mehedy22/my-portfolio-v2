import type { ReactNode } from "react";

/**
 * Marks for the skill tiles.
 *
 * <p>Skills are admin-editable free text — "PostgreSQL", "Postgres" and "postgresql 16" are all
 * things someone will type — so the mark is chosen by matching the name, not by an enum the admin
 * would have to learn. `skill.icon` still wins when it holds a URL, which is the escape hatch for
 * anything this list does not know.
 *
 * <p>These are deliberately generic glyphs by family (a database, a container, a cloud, a
 * terminal), not brand logos: a hand-traced approximation of a trademark reads as a worse version
 * of the real thing, whereas an honest family mark reads as a category. Anything unmatched falls
 * back to a monogram of the skill's own initial, so a tile is never empty.
 */
const PATHS: Record<string, ReactNode> = {
  // Languages and runtimes
  java: (
    <>
      <path d="M8 20h8" />
      <path d="M9 16h6a3 3 0 0 0 0-6H9a3 3 0 0 0 0 6z" />
      <path d="M18 11h1a2 2 0 0 1 0 4h-1" />
      <path d="M11 7c0-1 2-1.5 2-3" />
    </>
  ),
  python: (
    <>
      <path d="M12 3c-2.5 0-4 1-4 3v2h8v1H6a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h2v-3a3 3 0 0 1 3-3h4" />
      <path d="M12 21c2.5 0 4-1 4-3v-2H8v-1h10a3 3 0 0 0 3-3V10a3 3 0 0 0-3-3h-2v3a3 3 0 0 1-3 3H9" />
    </>
  ),
  // Braces stand in for every other language: it is what code looks like.
  code: (
    <>
      <path d="M8 4c-2 0-2 3-2 4s0 2-2 2v4c2 0 2 1 2 2s0 4 2 4" />
      <path d="M16 4c2 0 2 3 2 4s0 2 2 2v4c-2 0-2 1-2 2s0 4-2 4" />
    </>
  ),
  spring: (
    <>
      <path d="M12 21c5 0 8-3.5 8-8 0-4-2-7-8-10C6 6 4 9 4 13c0 4.5 3 8 8 8z" />
      <path d="M12 21V9" />
      <path d="M12 14l3.5-3.5" />
    </>
  ),
  react: (
    <>
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    </>
  ),
  // A browser window: the front end, whatever it is built with.
  web: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M7 6.5h.01M10 6.5h.01" />
    </>
  ),
  style: (
    <>
      <path d="M4 15l7-7 5 5-7 7H4z" />
      <path d="M14 5l3-3 5 5-3 3z" />
      <path d="M6 20h6" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  // Documents in a store, rather than rows in a table.
  documentstore: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  // In-memory / streaming: fast, transient, event-shaped.
  stream: (
    <>
      <path d="M13 2L5 14h6l-1 8 8-12h-6z" />
    </>
  ),
  queue: (
    <>
      <rect x="3" y="6" width="5" height="12" rx="1" />
      <rect x="10" y="6" width="5" height="12" rx="1" />
      <path d="M18 9l3 3-3 3" />
    </>
  ),
  container: (
    <>
      <rect x="3" y="9" width="18" height="9" rx="1.5" />
      <path d="M7 9V6h4v3M13 9V7h4v2" />
      <path d="M3 14h18" />
    </>
  ),
  orchestration: (
    <>
      <path d="M12 3l7 4v10l-7 4-7-4V7z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3v6M19 7l-4.8 3.5M19 17l-4.8-3.5M5 17l4.8-3.5M5 7l4.8 3.5M12 21v-6" />
    </>
  ),
  cloud: (
    <>
      <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.96A6 6 0 0 0 6.2 11.2A3.9 3.9 0 0 0 7 19z" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M13 15h4" />
    </>
  ),
  git: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M6 8.5v7M8.5 6h4a3 3 0 0 1 3 3v.6M8.5 18h4a3 3 0 0 0 3-3v-.6" />
    </>
  ),
  pipeline: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  api: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 0 0 18a14 14 0 0 0 0-18z" />
    </>
  ),
  graphql: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <circle cx="12" cy="3" r="1.6" />
      <circle cx="20" cy="7.5" r="1.6" />
      <circle cx="20" cy="16.5" r="1.6" />
      <circle cx="12" cy="21" r="1.6" />
      <circle cx="4" cy="16.5" r="1.6" />
      <circle cx="4" cy="7.5" r="1.6" />
    </>
  ),
  security: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.2 8.3-8 9-4.8-.7-8-4.5-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  testing: (
    <>
      <path d="M9 3h6M10 3v6l-4.5 8A2 2 0 0 0 7.3 20h9.4a2 2 0 0 0 1.8-3L14 9V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  mobile: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  ai: (
    <>
      <path d="M12 4a4 4 0 0 0-4 4v.5A3.5 3.5 0 0 0 6 12a3.5 3.5 0 0 0 2 3.2V16a4 4 0 0 0 8 0v-.8A3.5 3.5 0 0 0 18 12a3.5 3.5 0 0 0-2-3.5V8a4 4 0 0 0-4-4z" />
      <path d="M12 8v8M9.5 10.5h5M9.5 13.5h5" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7" y="12" width="3" height="5" />
      <rect x="12" y="8" width="3" height="9" />
      <rect x="17" y="14" width="3" height="3" />
    </>
  ),
  design: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <path d="M7 7h.01M7 17h.01" />
    </>
  ),
};

/**
 * Name fragment → glyph. Ordered longest-first at lookup, so "nextjs" is not swallowed by a
 * shorter key that happens to appear inside it.
 */
const ALIASES: Record<string, string> = {
  java: "java",
  javascript: "code",
  typescript: "code",
  kotlin: "code",
  scala: "code",
  groovy: "code",
  python: "python",
  django: "python",
  flask: "python",
  fastapi: "python",
  php: "code",
  laravel: "code",
  ruby: "code",
  rust: "code",
  golang: "code",
  csharp: "code",
  dotnet: "code",
  cpp: "code",
  spring: "spring",
  springboot: "spring",
  hibernate: "database",
  jpa: "database",
  react: "react",
  nextjs: "react",
  next: "react",
  angular: "web",
  vue: "web",
  svelte: "web",
  html: "web",
  jquery: "web",
  css: "style",
  sass: "style",
  scss: "style",
  tailwind: "style",
  bootstrap: "style",
  materialui: "style",
  node: "server",
  nodejs: "server",
  express: "server",
  nestjs: "server",
  nginx: "server",
  tomcat: "server",
  sql: "database",
  postgres: "database",
  postgresql: "database",
  mysql: "database",
  mariadb: "database",
  oracle: "database",
  sqlserver: "database",
  sqlite: "database",
  mongo: "documentstore",
  mongodb: "documentstore",
  cassandra: "documentstore",
  dynamodb: "documentstore",
  elasticsearch: "documentstore",
  redis: "stream",
  memcached: "stream",
  kafka: "stream",
  rabbitmq: "queue",
  activemq: "queue",
  sqs: "queue",
  docker: "container",
  podman: "container",
  kubernetes: "orchestration",
  k8s: "orchestration",
  helm: "orchestration",
  openshift: "orchestration",
  aws: "cloud",
  azure: "cloud",
  gcp: "cloud",
  googlecloud: "cloud",
  firebase: "cloud",
  heroku: "cloud",
  vercel: "cloud",
  linux: "terminal",
  ubuntu: "terminal",
  bash: "terminal",
  shell: "terminal",
  powershell: "terminal",
  git: "git",
  github: "git",
  gitlab: "git",
  bitbucket: "git",
  jenkins: "pipeline",
  cicd: "pipeline",
  githubactions: "pipeline",
  terraform: "pipeline",
  ansible: "pipeline",
  gradle: "pipeline",
  maven: "pipeline",
  rest: "api",
  restapi: "api",
  microservices: "api",
  grpc: "api",
  websocket: "api",
  soap: "api",
  graphql: "graphql",
  jwt: "security",
  oauth: "security",
  security: "security",
  keycloak: "security",
  junit: "testing",
  jest: "testing",
  testing: "testing",
  cypress: "testing",
  playwright: "testing",
  selenium: "testing",
  testcontainers: "testing",
  mockito: "testing",
  android: "mobile",
  ios: "mobile",
  flutter: "mobile",
  dart: "mobile",
  swift: "mobile",
  reactnative: "mobile",
  ai: "ai",
  ml: "ai",
  machinelearning: "ai",
  tensorflow: "ai",
  pytorch: "ai",
  llm: "ai",
  rag: "ai",
  nlp: "ai",
  opencv: "ai",
  pandas: "analytics",
  numpy: "analytics",
  analytics: "analytics",
  tableau: "analytics",
  powerbi: "analytics",
  excel: "analytics",
  figma: "design",
  photoshop: "design",
  illustrator: "design",
  ux: "design",
  ui: "design",
};

/**
 * Vendor and umbrella words, tried only after every product name has failed. "Apache Kafka" is
 * Kafka; matching it on "apache" would file it under web servers, and longest-key-first is no help
 * because the vendor word is the longer of the two.
 */
const VENDOR_ALIASES: Record<string, string> = {
  apache: "server",
  microsoft: "cloud",
  google: "cloud",
  amazon: "cloud",
};

/** Longest key first, so "nextjs" is not swallowed by a shorter key inside it. */
const KEYS = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
const VENDOR_KEYS = Object.keys(VENDOR_ALIASES).sort((a, b) => b.length - a.length);

/** The glyph key for a skill name, or null when nothing matches and a monogram is the answer. */
export function techIconKey(name: string | undefined): string | null {
  const normalized = (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return null;
  const match = KEYS.find((key) => normalized.includes(key));
  if (match) return ALIASES[match];
  const vendor = VENDOR_KEYS.find((key) => normalized.includes(key));
  return vendor ? VENDOR_ALIASES[vendor] : null;
}

export function TechIcon({
  name,
  icon,
  size = 18,
}: {
  name?: string;
  /** `skill.icon` from the API — used when it holds a URL; ignored otherwise. */
  icon?: string;
  size?: number;
}) {
  const remote = icon && /^(https?:\/\/|\/)/.test(icon) ? icon : null;
  if (remote) {
    // Deliberately a plain <img>: this is an admin-supplied URL on any host, and next/image would
    // need every one of those hosts declared in next.config before it would render at all. At 18px
    // there is nothing for an optimiser to save.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={remote}
        alt=""
        width={size}
        height={size}
        aria-hidden
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  const key = techIconKey(name);
  if (!key) {
    return (
      <span
        aria-hidden
        className="font-display font-semibold leading-none"
        style={{ fontSize: size * 0.72 }}
      >
        {(name ?? "?").trim().charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[key]}
    </svg>
  );
}
