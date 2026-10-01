import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import "./App.css";

type Email = {
  id: number;
  recipient: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
};

type SearchEmail = {
  id: number;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt?: string;
  sentAt?: string | null;
  status: string;
};

type Stats = {
  total: number;
  scheduled: number;
  sent: number;
  failed: number;
};

function App() {
  const [activeTab, setActiveTab] =
    useState<"scheduled" | "sent">("scheduled");

  const [showCompose, setShowCompose] =
    useState(false);

  const [recipient, setRecipient] =
    useState("");

  const [subject, setSubject] =
    useState("");

  const [body, setBody] =
    useState("");

  const [scheduledAt, setScheduledAt] =
    useState("");

  const [delay, setDelay] =
    useState(2);

  const [hourlyLimit, setHourlyLimit] =
    useState(100);

  const [csvEmails, setCsvEmails] =
    useState<string[]>([]);

  const [emails, setEmails] =
    useState<Email[]>([]);

  const [stats, setStats] = useState<Stats>({
    total: 0,
    scheduled: 0,
    sent: 0,
    failed: 0,
  });

  const [loading, setLoading] =
    useState(false);

  const [scheduling, setScheduling] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<SearchEmail[]>([]);

  const [searching, setSearching] =
    useState(false);

  const [showSearchResults, setShowSearchResults] =
    useState(false);

  // ==================================================
  // CURRENT DATE
  // ==================================================

  const today = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date());
  }, []);

  // ==================================================
  // IST DATETIME HELPERS
  // ==================================================

  /*
    datetime-local returns:

    YYYY-MM-DDTHH:mm

    Example:

    2026-09-30T20:35

    We MUST interpret this as:

    2026-09-30 20:35 IST

    which is:

    2026-09-30T15:05:00.000Z
  */

  const parseISTDateTime = (
    value: string
  ): Date => {
    if (!value) {
      return new Date(NaN);
    }

    const parts = value.split("T");

    if (parts.length !== 2) {
      return new Date(NaN);
    }

    const datePart = parts[0];
    const timePart = parts[1];

    const isoString =
      `${datePart}T${timePart}:00+05:30`;

    return new Date(isoString);
  };

  // ==================================================
  // FETCH CURRENT EMAILS
  // ==================================================

  const fetchEmails = async () => {
    setLoading(true);

    try {
      const status =
        activeTab === "scheduled"
          ? "scheduled"
          : "sent";

      const response = await fetch(
        `http://localhost:4000/api/emails?status=${status}`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch emails"
        );
      }

      const data =
        (await response.json()) as Email[];

      setEmails(data);
    } catch (error) {
      console.error(
        "Fetch email error:",
        error
      );

      setMessage(
        "Failed to load emails ❌"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // FETCH STATS
  // ==================================================

  const fetchStats = async () => {
    try {
      const response = await fetch(
        "http://localhost:4000/api/emails"
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch statistics"
        );
      }

      const data =
        (await response.json()) as Email[];

      setStats({
        total: data.length,

        scheduled: data.filter(
          (email) =>
            email.status === "scheduled"
        ).length,

        sent: data.filter(
          (email) =>
            email.status === "sent"
        ).length,

        failed: data.filter(
          (email) =>
            email.status === "failed"
        ).length,
      });
    } catch (error) {
      console.error(
        "Stats error:",
        error
      );
    }
  };

  // ==================================================
  // INITIAL LOAD + AUTO REFRESH
  // ==================================================

  useEffect(() => {
    fetchEmails();
  }, [activeTab]);

  useEffect(() => {
    fetchStats();

    const interval =
      setInterval(() => {
        fetchEmails();
        fetchStats();
      }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [activeTab]);

  // ==================================================
  // CSV / TXT UPLOAD
  // ==================================================

  const handleFileUpload = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text =
        await file.text();

      const foundEmails =
        text
          .split(/[\s,;]+/)
          .map((item) =>
            item.trim()
          )
          .filter((item) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              item
            )
          );

      const uniqueEmails = [
        ...new Set(foundEmails),
      ];

      setCsvEmails(
        uniqueEmails
      );

      if (
        uniqueEmails.length === 0
      ) {
        setMessage(
          "No valid email addresses found."
        );
      } else {
        setMessage(
          `${uniqueEmails.length} email ${
            uniqueEmails.length === 1
              ? "address"
              : "addresses"
          } detected ✅`
        );
      }
    } catch (error) {
      console.error(
        "File reading error:",
        error
      );

      setMessage(
        "Failed to read the file ❌"
      );
    }
  };

  // ==================================================
  // SCHEDULE EMAILS
  // ==================================================

  const handleSchedule = async () => {
    const recipients =
      csvEmails.length > 0
        ? csvEmails
        : recipient
          ? [recipient]
          : [];

    // ------------------------------------------------
    // VALIDATION
    // ------------------------------------------------

    if (
      !subject ||
      !body ||
      !scheduledAt
    ) {
      setMessage(
        "Please fill in subject, body and start time."
      );

      return;
    }

    if (
      recipients.length === 0
    ) {
      setMessage(
        "Enter a recipient email or upload a CSV/TXT file."
      );

      return;
    }

    if (delay < 0) {
      setMessage(
        "Delay cannot be negative."
      );

      return;
    }

    if (hourlyLimit < 1) {
      setMessage(
        "Hourly limit must be at least 1."
      );

      return;
    }

    setScheduling(true);
    setMessage("");

    try {
      // ------------------------------------------------
      // IMPORTANT:
      // Interpret datetime-local as IST.
      // ------------------------------------------------

      const startTime =
        parseISTDateTime(
          scheduledAt
        );

      if (
        isNaN(
          startTime.getTime()
        )
      ) {
        throw new Error(
          "Invalid start time"
        );
      }

      console.log(
        "Entered datetime-local:",
        scheduledAt
      );

      console.log(
        "Interpreted as IST:",
        scheduledAt
      );

      console.log(
        "Converted UTC ISO:",
        startTime.toISOString()
      );

      // ------------------------------------------------
      // CREATE EMAIL JOBS
      // ------------------------------------------------

      for (
        let i = 0;
        i < recipients.length;
        i++
      ) {
        /*
          Email scheduling:

          Email 1:
          start time

          Email 2:
          start + delay seconds

          After hourlyLimit:
          move to next hour
        */

        const hourOffset =
          Math.floor(
            i / hourlyLimit
          ) *
          60 *
          60 *
          1000;

        const positionInHour =
          i % hourlyLimit;

        const delayOffset =
          positionInHour *
          delay *
          1000;

        const emailTime =
          new Date(
            startTime.getTime() +
              hourOffset +
              delayOffset
          );

        // ------------------------------------------------
        // SEND UTC ISO TO BACKEND
        // ------------------------------------------------

        const utcISO =
          emailTime.toISOString();

        console.log(
          `Email ${i + 1}:`
        );

        console.log(
          "Recipient:",
          recipients[i]
        );

        console.log(
          "IST input:",
          scheduledAt
        );

        console.log(
          "UTC sent to backend:",
          utcISO
        );

        const response =
          await fetch(
            "http://localhost:4000/api/schedule",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                recipient:
                  recipients[i],

                subject,

                body,

                scheduledAt:
                  utcISO,

                delay,

                hourlyLimit,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              `Failed to schedule ${recipients[i]}`
          );
        }
      }

      // ------------------------------------------------
      // SUCCESS
      // ------------------------------------------------

      setMessage(
        `${recipients.length} email${
          recipients.length > 1
            ? "s"
            : ""
        } scheduled successfully ✅`
      );

      setRecipient("");
      setSubject("");
      setBody("");
      setScheduledAt("");
      setDelay(2);
      setHourlyLimit(100);
      setCsvEmails([]);

      setShowCompose(false);

      setActiveTab(
        "scheduled"
      );

      await fetchEmails();
      await fetchStats();
    } catch (error) {
      console.error(
        "Schedule error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to schedule emails ❌"
      );
    } finally {
      setScheduling(false);
    }
  };

  // ==================================================
  // SEARCH
  // ==================================================

  const handleSearch = async () => {
    const query =
      searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);

    try {
      const response =
        await fetch(
          `http://localhost:4000/api/search?q=${encodeURIComponent(
            query
          )}`
        );

      if (!response.ok) {
        throw new Error(
          "Search failed"
        );
      }

      const data =
        (await response.json()) as SearchEmail[];

      setSearchResults(
        data.filter(Boolean)
      );

      setShowSearchResults(true);
    } catch (error) {
      console.error(
        "Search error:",
        error
      );

      setMessage(
        "Search failed ❌"
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  // ==================================================
  // IST DISPLAY FORMAT
  // ==================================================

  const formatIST = (value: string | null) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(date);
  };

  // ==================================================
  // OPEN COMPOSE
  // ==================================================

  const openCompose = () => {
    setMessage("");
    setShowCompose(true);
  };

  // ==================================================
  // CLOSE COMPOSE
  // ==================================================

  const closeCompose = () => {
    if (scheduling) {
      return;
    }

    setShowCompose(false);
  };

  // ==================================================
  // UI
  // ==================================================

  return (
    <div className="app-shell">

      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-icon">
            R
          </div>

          <div>
            <h1>ReachInbox</h1>

            <span>
              Email Scheduler
            </span>
          </div>

        </div>

        <div className="workspace-label">
          WORKSPACE
        </div>

        <div className="workspace-card">

          <div className="workspace-avatar">
            H
          </div>

          <div>
            <strong>
              Harshitha
            </strong>

            <span>
              Personal workspace
            </span>
          </div>

        </div>

        <nav className="sidebar-nav">

          <button
            className="nav-item"
            onClick={() => {
              setActiveTab(
                "scheduled"
              );

              setShowSearchResults(
                false
              );
            }}
          >
            <span className="nav-icon">
              ▦
            </span>

            <span>
              Overview
            </span>
          </button>

          <button
            className={
              activeTab === "scheduled"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setActiveTab(
                "scheduled"
              );

              setShowSearchResults(
                false
              );
            }}
          >
            <span className="nav-icon">
              ◷
            </span>

            <span>
              Scheduled
            </span>

            <span className="nav-count">
              {stats.scheduled}
            </span>
          </button>

          <button
            className={
              activeTab === "sent"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setActiveTab(
                "sent"
              );

              setShowSearchResults(
                false
              );
            }}
          >
            <span className="nav-icon">
              ✓
            </span>

            <span>
              Sent
            </span>

            <span className="nav-count">
              {stats.sent}
            </span>
          </button>

        </nav>

        <div className="sidebar-bottom">

          <div className="system-card">

            <div className="system-dot" />

            <div>
              <strong>
                System online
              </strong>

              <span>
                Scheduler is running
              </span>
            </div>

          </div>

          <div className="sidebar-user">

            <div className="mini-avatar">
              H
            </div>

            <div className="sidebar-user-info">

              <strong>
                Harshitha
              </strong>

              <span>
                harshitha@example.com
              </span>

            </div>

            <span className="user-menu">
              •••
            </span>

          </div>

        </div>

      </aside>

      {/* ==================================================
          MAIN
      ================================================== */}

      <main className="main-content">

        <header className="topbar">

          <div className="topbar-date">
            {today}
          </div>

          <div className="topbar-actions">

            <div className="notification">
              ◌
            </div>

            <div className="top-avatar">
              H
            </div>

          </div>

        </header>

        <div className="content">

          {/* HERO */}

          <section className="hero">

            <div>

              <div className="eyebrow">
                EMAIL AUTOMATION
              </div>

              <h2>
                Good day, Harshitha
                <span> 👋</span>
              </h2>

              <p>
                Manage your campaigns,
                schedule emails and
                keep track of delivery.
              </p>

            </div>

            <button
              className="primary-button"
              onClick={openCompose}
            >
              <span className="button-plus">
                +
              </span>

              Compose Email
            </button>

          </section>

          {/* MESSAGE */}

          {message && (
            <div className="toast-message">

              <span>
                {message}
              </span>

              <button
                onClick={() =>
                  setMessage("")
                }
              >
                ×
              </button>

            </div>
          )}

          {/* STATS */}

          <section className="stats-grid">

            <div className="stat-card">

              <div className="stat-icon purple">
                ✉
              </div>

              <div className="stat-content">

                <span className="stat-label">
                  Total Emails
                </span>

                <strong>
                  {stats.total}
                </strong>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon orange">
                ◷
              </div>

              <div className="stat-content">

                <span className="stat-label">
                  Scheduled
                </span>

                <strong>
                  {stats.scheduled}
                </strong>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon green">
                ✓
              </div>

              <div className="stat-content">

                <span className="stat-label">
                  Sent
                </span>

                <strong>
                  {stats.sent}
                </strong>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon red">
                !
              </div>

              <div className="stat-content">

                <span className="stat-label">
                  Failed
                </span>

                <strong>
                  {stats.failed}
                </strong>

              </div>

            </div>

          </section>

          {/* EMAIL PANEL */}

          <section className="email-panel">

            <div className="panel-top">

              <div>

                <div className="panel-title-row">

                  <h3>
                    {activeTab ===
                    "scheduled"
                      ? "Scheduled emails"
                      : "Sent emails"}
                  </h3>

                  <span className="result-count">
                    {emails.length}
                  </span>

                </div>

                <p>
                  {activeTab ===
                  "scheduled"
                    ? "Emails waiting to be delivered."
                    : "Emails successfully processed by the worker."}
                </p>

              </div>

              <div className="search-wrapper">

                <span className="search-icon">
                  ⌕
                </span>

                <input
                  type="text"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(
                      e.target.value
                    )
                  }
                  onKeyDown={
                    handleSearchKeyDown
                  }
                />

                {searchQuery && (
                  <button
                    className="clear-search"
                    onClick={() => {
                      setSearchQuery(
                        ""
                      );

                      setSearchResults(
                        []
                      );

                      setShowSearchResults(
                        false
                      );
                    }}
                  >
                    ×
                  </button>
                )}

                <button
                  className="search-button"
                  onClick={handleSearch}
                  disabled={searching}
                >
                  {searching
                    ? "..."
                    : "Search"}
                </button>

              </div>

            </div>

            {/* SEARCH RESULTS */}

            {showSearchResults && (
              <div className="search-results">

                <div className="search-results-header">

                  <strong>
                    Search results
                  </strong>

                  <button
                    onClick={() =>
                      setShowSearchResults(
                        false
                      )
                    }
                  >
                    Close
                  </button>

                </div>

                {searchResults.length ===
                0 ? (
                  <div className="search-empty">
                    No matching emails found.
                  </div>
                ) : (
                  searchResults.map(
                    (result) => (
                      <div
                        className="search-result-item"
                        key={result.id}
                      >

                        <div className="search-result-avatar">
                          {result.recipient
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="search-result-main">

                          <strong>
                            {result.subject}
                          </strong>

                          <span>
                            {result.recipient}
                          </span>

                        </div>

                        <span
                          className={`status-pill ${result.status}`}
                        >
                          {result.status}
                        </span>

                      </div>
                    )
                  )
                )}

              </div>
            )}

            {/* TABS */}

            <div className="panel-tabs">

              <button
                className={
                  activeTab ===
                  "scheduled"
                    ? "panel-tab active"
                    : "panel-tab"
                }
                onClick={() =>
                  setActiveTab(
                    "scheduled"
                  )
                }
              >
                Scheduled

                <span>
                  {stats.scheduled}
                </span>

              </button>

              <button
                className={
                  activeTab === "sent"
                    ? "panel-tab active"
                    : "panel-tab"
                }
                onClick={() =>
                  setActiveTab("sent")
                }
              >
                Sent

                <span>
                  {stats.sent}
                </span>

              </button>

            </div>

            {/* TABLE */}

            <div className="email-list">

              <div className="email-list-header">

                <span>
                  RECIPIENT
                </span>

                <span>
                  SUBJECT
                </span>

                <span>
                  {activeTab ===
                  "scheduled"
                    ? "SCHEDULED TIME"
                    : "SENT TIME"}
                </span>

                <span>
                  STATUS
                </span>

              </div>

              {loading ? (
                <div className="empty-state">

                  <div className="spinner" />

                  <strong>
                    Loading emails...
                  </strong>

                  <span>
                    Refreshing your inbox.
                  </span>

                </div>
              ) : emails.length ===
                0 ? (
                <div className="empty-state">

                  <div className="empty-icon">
                    ✉
                  </div>

                  <strong>
                    {activeTab ===
                    "scheduled"
                      ? "No scheduled emails"
                      : "No sent emails yet"}
                  </strong>

                  <span>
                    {activeTab ===
                    "scheduled"
                      ? "Your upcoming emails will appear here."
                      : "Emails sent by the worker will appear here."}
                  </span>

                  {activeTab ===
                    "scheduled" && (
                    <button
                      className="secondary-button"
                      onClick={
                        openCompose
                      }
                    >
                      Schedule your first email
                    </button>
                  )}

                </div>
              ) : (
                emails.map(
                  (email) => (
                    <div
                      className="email-row"
                      key={email.id}
                    >

                      <div className="recipient-cell">

                        <div className="recipient-avatar">
                          {email.recipient
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="recipient-info">

                          <strong>
                            {email.recipient}
                          </strong>

                          <span>
                            Email ID #
                            {email.id}
                          </span>

                        </div>

                      </div>

                      <div className="subject-cell">

                        <strong>
                          {email.subject}
                        </strong>

                        <span>
                          {email.body}
                        </span>

                      </div>

                      <div className="time-cell">
                        <strong>
                          {activeTab === "scheduled"
                            ? formatIST(email.scheduled_at)
                            : formatIST(email.sent_at)}
                        </strong>

                        <span>IST</span>
                      </div>

                      <div>

                        <span
                          className={`status-pill ${email.status}`}
                        >
                          <span className="status-dot" />
                          {email.status}
                        </span>

                      </div>

                    </div>
                  )
                )
              )}

            </div>

          </section>

        </div>

      </main>

      {/* ==================================================
          COMPOSE MODAL
      ================================================== */}

      {showCompose && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCompose();
            }
          }}
        >

          <div className="compose-modal">

            <div className="compose-modal-header">

              <div>

                <div className="modal-eyebrow">
                  NEW CAMPAIGN
                </div>

                <h2>
                  Compose email
                </h2>

                <p>
                  Create your email and
                  choose when it should be
                  delivered.
                </p>

              </div>

              <button
                className="close-modal"
                onClick={
                  closeCompose
                }
              >
                ×
              </button>

            </div>

            <div className="compose-body">

              {/* RECIPIENT */}

              <div className="form-section">

                <div className="section-heading">

                  <span className="section-number">
                    01
                  </span>

                  <div>

                    <strong>
                      Recipients
                    </strong>

                    <span>
                      Add one recipient or upload a list.
                    </span>

                  </div>

                </div>

                <label>
                  Recipient email
                </label>

                <input
                  className="modern-input"
                  type="email"
                  placeholder="recipient@example.com"
                  value={recipient}
                  onChange={(e) =>
                    setRecipient(
                      e.target.value
                    )
                  }
                />

                <div className="or-divider">

                  <span>
                    OR
                  </span>

                </div>

                <label
                  className="upload-box"
                >

                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={
                      handleFileUpload
                    }
                  />

                  <div className="upload-icon">
                    ↑
                  </div>

                  <div>

                    <strong>
                      Upload CSV or TXT
                    </strong>

                    <span>
                      Drop a lead list here or click to browse
                    </span>

                  </div>

                </label>

                {csvEmails.length >
                  0 && (
                  <div className="upload-success">

                    <span>
                      ✓
                    </span>

                    <strong>
                      {csvEmails.length}{" "}
                      addresses detected
                    </strong>

                    <small>
                      Ready for scheduling
                    </small>

                  </div>
                )}

              </div>

              {/* MESSAGE */}

              <div className="form-section">

                <div className="section-heading">

                  <span className="section-number">
                    02
                  </span>

                  <div>

                    <strong>
                      Message
                    </strong>

                    <span>
                      Write the email you want to send.
                    </span>

                  </div>

                </div>

                <label>
                  Subject
                </label>

                <input
                  className="modern-input"
                  type="text"
                  placeholder="Enter email subject"
                  value={subject}
                  onChange={(e) =>
                    setSubject(
                      e.target.value
                    )
                  }
                />

                <label>
                  Email body
                </label>

                <textarea
                  className="modern-textarea"
                  placeholder="Write your email message..."
                  rows={7}
                  value={body}
                  onChange={(e) =>
                    setBody(
                      e.target.value
                    )
                  }
                />

              </div>

              {/* DELIVERY */}

              <div className="form-section">

                <div className="section-heading">

                  <span className="section-number">
                    03
                  </span>

                  <div>

                    <strong>
                      Delivery settings
                    </strong>

                    <span>
                      Control when and how fast emails are sent.
                    </span>

                  </div>

                </div>

                <label>
                  Start time
                </label>

                <input
                  className="modern-input"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) =>
                    setScheduledAt(
                      e.target.value
                    )
                  }
                />

                <div className="settings-grid">

                  <div>

                    <label>
                      Delay between emails
                    </label>

                    <div className="input-with-unit">

                      <input
                        className="modern-input"
                        type="number"
                        min="0"
                        value={delay}
                        onChange={(e) =>
                          setDelay(
                            Number(
                              e.target.value
                            )
                          )
                        }
                      />

                      <span>
                        sec
                      </span>

                    </div>

                  </div>

                  <div>

                    <label>
                      Hourly limit
                    </label>

                    <div className="input-with-unit">

                      <input
                        className="modern-input"
                        type="number"
                        min="1"
                        value={
                          hourlyLimit
                        }
                        onChange={(e) =>
                          setHourlyLimit(
                            Number(
                              e.target.value
                            )
                          )
                        }
                      />

                      <span>
                        / hour
                      </span>

                    </div>

                  </div>

                </div>

              </div>

            </div>

            <div className="compose-modal-footer">

              <button
                className="secondary-button"
                onClick={
                  closeCompose
                }
                disabled={
                  scheduling
                }
              >
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={
                  handleSchedule
                }
                disabled={
                  scheduling
                }
              >
                {scheduling ? (
                  <>
                    <span className="button-spinner" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    Schedule Email
                    <span>
                      →
                    </span>
                  </>
                )}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default App;