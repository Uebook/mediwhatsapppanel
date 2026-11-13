# MediConnect WhatsApp Support & Operations Desk

Enterprise WhatsApp operations, live human takeover desk, and automated patient journey management panel for MediConnect.fit.

## Features

- **Live Multi-Agent Chat**: Real-time incoming & outgoing WhatsApp communications with media preview.
- **Human Takeovers & Escalations**: Seamless transitions between AI triage and clinical support agents.
- **Supabase Cloud RBAC**: Role-based access control (Super Admin, Support Agent, Medical Operations) synced with Supabase Auth and Cloud Storage.
- **Broadcast Campaigns & Templates**: WhatsApp Cloud API & InSign template management and bulk dispatch tracking.
- **Workflow & Recovery**: Patient journey monitoring and health episode tracking.
- **Audit Trails**: Complete operational logging and clinician takeover history.

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your credentials:
```bash
cp .env.example .env.local
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or configured port) in your browser.

### 4. Build for Production
```bash
npm run build
npm run start
```

