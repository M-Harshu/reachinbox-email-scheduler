# ReachInbox Email Scheduler

A local full-stack MVP of an email scheduling and delivery system built using React, Node.js, Express, PostgreSQL, Redis, BullMQ, Elasticsearch, Slack OAuth, Bull Board, and Ethereal Email.

The application allows users to schedule emails, store email information, process scheduled jobs in the background, search emails using Elasticsearch, monitor BullMQ jobs through Bull Board, and receive Slack notifications when emails are sent.

---

## 1. Features

- Schedule emails for a future time
- Store email details in PostgreSQL
- Process scheduled emails using BullMQ
- Use Redis as the BullMQ queue backend
- Background email worker
- Email concurrency support
- Ethereal Email for testing email delivery
- Elasticsearch indexing and email search
- BullMQ monitoring using Bull Board
- Slack OAuth integration
- Slack notifications when an email is successfully sent
- CSV-based email input from the frontend
- Scheduled Emails dashboard
- Sent Emails dashboard
- Basic backend validation and error handling
- Failed email status handling

---

## 2. Tech Stack

### Frontend

- React
- TypeScript
- Vite
- CSS

### Backend

- Node.js
- Express
- TypeScript

### Database

- PostgreSQL

### Queue

- Redis
- BullMQ

### Search

- Elasticsearch

### Email

- Nodemailer
- Ethereal Email

### Notifications

- Slack OAuth
- Slack Incoming Webhooks

### Monitoring

- Bull Board

### Containers

- Docker
- Docker Compose

---

## 3. Project Structure

```text
reachinbox-email-scheduler/
│
├── backend/
│   ├── src/
│   │   ├── db.ts
│   │   ├── elasticsearch.ts
│   │   ├── init-db.ts
│   │   ├── queue.ts
│   │   ├── server.ts
│   │   ├── slack.ts
│   │   └── worker.ts
│   │
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
│
├── frontend-app/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── docker-compose.yml
└── README.md
4. Architecture
                    React Frontend
                          |
                          v
                  Express Backend
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
     PostgreSQL      Elasticsearch     BullMQ
          |                               |
          |                               v
          |                              Redis
          |                               |
          |                               v
          |                         Background Worker
          |                               |
          |                    +----------+----------+
          |                    |                     |
          v                    v                     v
       Email Data          Ethereal              Slack
                              Email             Notification
5. Requirements

Install the following before running the project:

Node.js
npm
Docker Desktop
Git

Docker Desktop must be running before starting PostgreSQL, Redis, and Elasticsearch.

6. Start Docker Services

Open PowerShell in the project root:

cd C:\Users\mkjnh\reachinbox-email-scheduler\reachinbox-email-scheduler

Start Docker services:

docker compose up -d

The project uses:

PostgreSQL       localhost:15432
Redis            localhost:6379
Elasticsearch    localhost:9200

Check the running containers:

docker ps

Expected containers:

reachinbox-postgres
reachinbox-redis
reachinbox-elasticsearch
7. Backend Environment Variables

Create:

backend/.env

Use the following structure:

PORT=4000

DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:15432/reachinbox

REDIS_URL=redis://localhost:6379

ELASTICSEARCH_URL=http://localhost:9200

SLACK_CLIENT_ID=YOUR_SLACK_CLIENT_ID

SLACK_CLIENT_SECRET=YOUR_SLACK_CLIENT_SECRET

SLACK_REDIRECT_URI=YOUR_SLACK_HTTPS_CALLBACK_URL

SLACK_WEBHOOK_URL=YOUR_SLACK_WEBHOOK_URL

Replace the placeholder values with your own local values.

Do not commit .env to Git.

8. Install Backend Dependencies

Open a new terminal:

cd C:\Users\mkjnh\reachinbox-email-scheduler\reachinbox-email-scheduler\backend

Install dependencies:

npm install
9. Initialize the Database

Run:

npx ts-node-dev --transpile-only src/init-db.ts

Expected output:

Database tables created successfully ✅

This creates the following tables:

emails
app_settings
10. Start the Backend

Run:

npm run dev

Expected output:

Elasticsearch emails index already exists ✅
Backend running on http://localhost:4000
Bull Board: http://localhost:4000/admin/queues
Slack OAuth: http://localhost:4000/auth/slack/install

Backend API:

http://localhost:4000
11. Start the Email Worker

Open another terminal:

cd C:\Users\mkjnh\reachinbox-email-scheduler\reachinbox-email-scheduler\backend

Run:

npx ts-node-dev --respawn --transpile-only src/worker.ts

Expected output:

Email worker starting...
🚀 Worker connected to Redis and ready

Keep this terminal running.

12. Start the Frontend

Open another terminal:

cd C:\Users\mkjnh\reachinbox-email-scheduler\reachinbox-email-scheduler\frontend-app

Install dependencies if required:

npm install

Start the frontend:

npm run dev

Open:

http://localhost:5173
13. Running the Full Application

For normal development, keep these services running:

Docker
PostgreSQL
Redis
Elasticsearch
Terminal 1
Backend
http://localhost:4000
Terminal 2
Worker
BullMQ + Redis
Terminal 3
Frontend
http://localhost:5173
14. Email Scheduling Flow

When a user schedules an email:

React Dashboard
      |
      v
POST /api/schedule
      |
      v
PostgreSQL
      |
      +----> Elasticsearch
      |
      +----> BullMQ
                |
                v
              Redis
                |
                v
             Worker
                |
                v
           Ethereal Email
                |
                v
        Slack Notification
15. PostgreSQL

PostgreSQL stores the application email data.

The emails table contains:

id
recipient
subject
body
scheduled_at
status
sent_at

The app_settings table stores application settings such as the Slack webhook generated through OAuth.

16. Redis and BullMQ

Redis is used as the backend for BullMQ.

BullMQ handles:

Delayed email jobs
Background processing
Job states
Worker processing
Concurrent email processing

The worker currently uses:

Concurrency = 3

This allows up to three email jobs to be processed concurrently.

17. Elasticsearch

Emails are indexed in Elasticsearch using the:

emails

index.

Searchable fields include:

recipient
subject
body
status
scheduledAt
sentAt

Search endpoint:

GET /api/search?q=searchTerm

Example:

http://localhost:4000/api/search?q=Hello
18. Bull Board

Bull Board provides a visual interface for monitoring BullMQ.

Open:

http://localhost:4000/admin/queues

The dashboard provides visibility into:

Active jobs
Waiting jobs
Completed jobs
Failed jobs
Delayed jobs
Paused queues
19. Slack Integration

Slack is integrated using OAuth and Incoming Webhooks.

Slack OAuth installation route:

/auth/slack/install

Local backend route:

http://localhost:4000/auth/slack/install

For local HTTPS OAuth testing, an HTTPS tunnel such as ngrok can be used.

Example:

ngrok http 4000

The HTTPS callback must match the redirect URL configured in the Slack application.

Example:

https://your-ngrok-domain.ngrok-free.dev/auth/slack/callback

After Slack authorization:

Slack OAuth
     |
     v
OAuth callback
     |
     v
Webhook URL
     |
     v
PostgreSQL app_settings
     |
     v
Background Worker
     |
     v
Slack Notification

A successful email generates a Slack notification containing:

📧 ReachInbox Email Sent

Recipient: test@example.com
Subject: Hello
Status: Sent ✅
Email ID: 10
20. Ethereal Email

The application uses Ethereal Email for test email delivery.

When an email is successfully processed, the worker prints a preview link:

🔗 Preview: https://ethereal.email/message/...

Open this URL in a browser to view the test email.

Ethereal is used for demonstration/testing instead of sending real production emails.

21. CSV Upload

The frontend supports CSV-based email input.

Expected CSV structure:

email,subject,body
test1@example.com,Hello 1,This is test email 1
test2@example.com,Hello 2,This is test email 2
test3@example.com,Hello 3,This is test email 3

The CSV can be prepared in Excel and saved as:

CSV UTF-8 (*.csv)
22. API Endpoints
Health Check
GET /
Schedule Email
POST /api/schedule

Example request:

{
  "recipient": "test@example.com",
  "subject": "Hello",
  "body": "This is a test email.",
  "scheduledAt": "2026-10-01T10:00:00.000Z"
}
Get All Emails
GET /api/emails
Get Scheduled Emails
GET /api/emails?status=scheduled
Get Sent Emails
GET /api/emails?status=sent
Get Failed Emails
GET /api/emails?status=failed
Search Emails
GET /api/search?q=Hello
Slack OAuth
GET /auth/slack/install
Bull Board
http://localhost:4000/admin/queues
23. Validation and Error Handling

The backend validates:

Required email fields
Recipient email format
Scheduled date

The backend also handles failures from:

PostgreSQL
BullMQ
Elasticsearch
Slack
Email worker

The scheduling flow uses PostgreSQL as the primary source of truth.

If Elasticsearch indexing fails, the email can still continue to BullMQ.

If BullMQ fails after the email has been stored in PostgreSQL, the email is marked as:

failed

Worker failures are also handled by updating the email status where appropriate.

24. Security

Never commit secrets to Git.

The following values must remain private:

SLACK_CLIENT_SECRET
SLACK_WEBHOOK_URL
ngrok authtoken
other credentials

Keep them in:

backend/.env

Make sure .env is listed in .gitignore.

25. .gitignore

The backend should ignore:

node_modules/
.env
dist/

The frontend should also ignore:

node_modules/
dist/
.env
26. Final Testing Checklist

Before demonstrating the project, verify:

[ ] Docker services are running
[ ] PostgreSQL is running
[ ] Redis is running
[ ] Elasticsearch is running
[ ] Backend is running
[ ] Worker is running
[ ] Frontend is running
[ ] Dashboard loads
[ ] Single email can be scheduled
[ ] Scheduled email appears in the dashboard
[ ] BullMQ job appears in Bull Board
[ ] Worker processes the job
[ ] Ethereal preview URL is generated
[ ] Email moves to Sent Emails
[ ] Elasticsearch search works
[ ] Slack OAuth works
[ ] Slack webhook is stored
[ ] Slack notification appears
[ ] CSV upload works
[ ] Multiple emails can be scheduled
[ ] Failed-job handling works
[ ] Time display is verified
27. Quick Start
Start Docker
docker compose up -d
Start Backend
cd backend
npm run dev
Start Worker
cd backend
npx ts-node-dev --respawn --transpile-only src/worker.ts
Start Frontend
cd frontend-app
npm run dev

Then open:

http://localhost:5173

Bull Board:

http://localhost:4000/admin/queues
28. Current Project Scope

This project is implemented as a local MVP for demonstration and development.

Implemented:

Email scheduling
PostgreSQL persistence
Redis
BullMQ
Background worker
Ethereal test email delivery
Elasticsearch
Elasticsearch email search
Bull Board monitoring
Slack OAuth
Slack notifications
CSV input
Basic validation
Error handling

The following original assignment features were intentionally not implemented:

Google OAuth
Production deployment
Production-grade authentication and user management
Full production infrastructure
Advanced production monitoring
Slack Marketplace distribution
29. Project Summary

ReachInbox Email Scheduler is a full-stack local MVP demonstrating a queue-based email scheduling architecture.

The system separates scheduling from delivery by using:

PostgreSQL for persistence
Redis and BullMQ for background jobs
A dedicated worker for email processing
Elasticsearch for email search
Bull Board for queue monitoring
Slack OAuth and notifications for delivery updates
Ethereal Email for safe test email delivery

The project is designed for local development, demonstration, and evaluation.