-- =====================================================================
--  Ledger Management — PostgreSQL schema (idempotent; safe to re-run)
-- =====================================================================

-- Users: one Admin (Tariq Awan) + any number of read-only Viewers
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(50)  NOT NULL UNIQUE,
  password_hash   TEXT         NOT NULL,
  name            VARCHAR(120) NOT NULL,
  role            VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'viewer')),
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  failed_attempts INT          NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  token_version   INT          NOT NULL DEFAULT 0,   -- bump to invalidate all sessions of a user
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- People / employees whose monthly amounts are tracked
CREATE TABLE IF NOT EXISTS people (
  id              SERIAL PRIMARY KEY,
  sr_no           INT          NOT NULL UNIQUE CHECK (sr_no > 0),
  name            VARCHAR(120) NOT NULL,
  father_name     VARCHAR(120) NOT NULL,
  status          VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  marital_status  VARCHAR(10)  NOT NULL CHECK (marital_status IN ('married', 'unmarried')),
  split_cash      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (split_cash >= 0),
  account         VARCHAR(60)  NOT NULL DEFAULT '',
  monthly_amount  NUMERIC(14,2) NOT NULL CHECK (monthly_amount >= 0),
  joining_date    DATE,
  notes           TEXT         NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS people_name_idx ON people (lower(name));

-- Years available in the ledger (2026, 2027, ...)
CREATE TABLE IF NOT EXISTS ledger_years (
  year        INT PRIMARY KEY CHECK (year BETWEEN 2000 AND 2100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per person per month: the amount due for that exact month
CREATE TABLE IF NOT EXISTS monthly_ledger (
  id               SERIAL PRIMARY KEY,
  person_id        INT      NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  year             INT      NOT NULL REFERENCES ledger_years(year),
  month            SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  required_amount  NUMERIC(14,2) NOT NULL CHECK (required_amount >= 0),
  notes            TEXT     NOT NULL DEFAULT '',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (person_id, year, month)
);
CREATE INDEX IF NOT EXISTS monthly_ledger_period_idx ON monthly_ledger (year, month);

-- Regular payments made FOR a specific month (partial payments allowed)
CREATE TABLE IF NOT EXISTS payments (
  id            SERIAL PRIMARY KEY,
  person_id     INT      NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  ledger_id     INT      NOT NULL REFERENCES monthly_ledger(id) ON DELETE CASCADE,
  year          INT      NOT NULL,
  month         SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date  DATE     NOT NULL,
  method        VARCHAR(30) NOT NULL DEFAULT 'cash',
  reference     VARCHAR(80) NOT NULL DEFAULT '',
  notes         TEXT     NOT NULL DEFAULT '',
  created_by    INT      REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_period_idx ON payments (year, month);
CREATE INDEX IF NOT EXISTS payments_person_idx ON payments (person_id);

-- An advance: money received on a date, for one or more FUTURE months
CREATE TABLE IF NOT EXISTS advances (
  id              SERIAL PRIMARY KEY,
  person_id       INT      NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  payment_date    DATE     NOT NULL,
  paid_in_year    INT      NOT NULL,
  paid_in_month   SMALLINT NOT NULL CHECK (paid_in_month BETWEEN 1 AND 12),
  total_amount    NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  status          VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  notes           TEXT     NOT NULL DEFAULT '',
  created_by      INT      REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at    TIMESTAMPTZ,
  cancelled_by    INT      REFERENCES users(id) ON DELETE SET NULL,
  cancel_reason   TEXT
);
CREATE INDEX IF NOT EXISTS advances_person_idx ON advances (person_id);
CREATE INDEX IF NOT EXISTS advances_paid_in_idx ON advances (paid_in_year, paid_in_month);

-- Exact link between an advance and each target month it covers
CREATE TABLE IF NOT EXISTS advance_allocations (
  id          SERIAL PRIMARY KEY,
  advance_id  INT      NOT NULL REFERENCES advances(id) ON DELETE CASCADE,
  person_id   INT      NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  ledger_id   INT      NOT NULL REFERENCES monthly_ledger(id) ON DELETE CASCADE,
  year        INT      NOT NULL,
  month       SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  UNIQUE (advance_id, year, month)
);
CREATE INDEX IF NOT EXISTS alloc_period_idx ON advance_allocations (year, month);
CREATE INDEX IF NOT EXISTS alloc_person_idx ON advance_allocations (person_id);

-- Month closing (permanent snapshot kept even after reopening)
CREATE TABLE IF NOT EXISTS monthly_closings (
  id              SERIAL PRIMARY KEY,
  year            INT      NOT NULL,
  month           SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  is_closed       BOOLEAN  NOT NULL DEFAULT TRUE,
  closed_at       TIMESTAMPTZ,
  closed_by       INT      REFERENCES users(id) ON DELETE SET NULL,
  closed_by_name  VARCHAR(120),
  snapshot        JSONB    NOT NULL DEFAULT '{}'::jsonb,
  close_count     INT      NOT NULL DEFAULT 0,
  reopened_at     TIMESTAMPTZ,
  reopened_by_name VARCHAR(120),
  reopen_reason   TEXT,
  UNIQUE (year, month)
);

-- Every close/reopen event (history is never overwritten)
CREATE TABLE IF NOT EXISTS closing_events (
  id          SERIAL PRIMARY KEY,
  year        INT      NOT NULL,
  month       SMALLINT NOT NULL,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('close', 'reopen')),
  snapshot    JSONB,
  reason      TEXT,
  user_name   VARCHAR(120),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which people each Viewer may see
CREATE TABLE IF NOT EXISTS viewer_assignments (
  viewer_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id   INT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (viewer_id, person_id)
);

-- Audit trail
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INT,
  user_name   VARCHAR(120),
  action      VARCHAR(60) NOT NULL,
  entity      VARCHAR(40),
  entity_id   INT,
  summary     TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log (created_at DESC);
