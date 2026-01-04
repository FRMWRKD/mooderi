---
description: Deploy backend to Hostinger via SSH
---

# Hostinger SSH Deployment

## Connection Details
- **Host:** 72.62.153.115
- **Port:** 65002
- **Username:** u193796451
- **Password:** V20+ONAs+frmwrkd

## SSH Command
```bash
ssh -p 65002 u193796451@72.62.153.115
```

## Initial Deployment Steps

1. Connect via SSH:
```bash
ssh -p 65002 u193796451@72.62.153.115
```

2. Navigate to web directory:
```bash
cd ~/domains/limegreen-turtle-410807.hostingersite.com/public_html
# OR find the correct directory with: ls ~/domains/
```

3. Clone the repository:
```bash
git clone https://github.com/ttoo17/mooderi.git .
# OR if folder not empty: git init && git remote add origin https://github.com/ttoo17/mooderi.git && git pull origin main
```

4. Navigate to backend:
```bash
cd backend
```

5. Install dependencies:
```bash
npm install
```

6. Create .env file with required variables:
```bash
nano .env
# Add: SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_API_KEY, STRAICO_API_KEY, MODAL_VIDEO_ENDPOINT
```

7. Start with PM2 (if available) or node:
```bash
pm2 start server.js --name moodboard-backend
# OR: node server.js &
```

## Update Deployment (Future Updates)

// turbo-all
1. SSH into server:
```bash
ssh -p 65002 u193796451@72.62.153.115
```

2. Navigate to backend:
```bash
cd ~/domains/*/public_html/backend
```

3. Pull latest changes:
```bash
git pull origin main
```

4. Install any new dependencies:
```bash
npm install
```

5. Restart the app:
```bash
pm2 restart moodboard-backend
```
