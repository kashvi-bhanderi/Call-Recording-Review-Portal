# 📞 Call Recording Review Portal
A role-based Call Recording Review System designed to streamline audio quality evaluation, feedback workflows, and QA processes across organizations.

## 🧾 Overview
This system enables Consultants and Leads to collaboratively review call recordings, rate performance using dynamic evaluation metrics, and manage feedback efficiently.

## 🚀 Features

### 🔹 MVP
- JWT-based authentication (role-based)
- Consultant & Lead review workflow
- Secure audio streaming (AWS S3 signed URLs)
- Dashboard with filters & pagination
- Dynamic evaluation metrics (admin configurable)
- Tagging system for QA analysis
- Call locking mechanism (prevents race conditions)
- Language-based and Organization-based access control
  
### ⚡ Advanced Features
#### 🎧 Audio Review System
- Waveform-based audio player
- Playback controls (speed, seek, volume)
- Secure streaming (no public S3 URLs)

#### ☁️ Google Drive Upload (Good Calls)
- Consultant mark audio as good audio to share with client, then in the dashboard click on the good audio to share button then that audio will uploaded to google drive with duplication check.

#### 📝 Call Transcript (TTS and STT ouput)
- Each call includes structured transcript:
   - Agent: Hello, how can I help you?
   - User: I want to check my loan status.
   - Agent: Sure, please confirm your ID.
     
- Features:
  - Agent/User separation
  - Helps quickly identify issues in conversation

## 🛠️ Tech Stack

### Backend
- Django
- Django REST Framework
- SimpleJWT

### Database
- PostgreySQL
- Clickhouse (Call metadata fecthing from this db)

### Storage
- AWS S3 (Private bucket)

### Frontend
- React.js

## 👥 User Roles
### 👨‍💻 Consultant
- View assigned calls (quick from dashboard, detailed from call audio page)
- Submit ratings 
- Add comments

### 👨‍💼 Lead
- Review consultant ratings
- Approve / Reject calls
- Rate the call
- Add tags
- Lock call during review

### 🛠️ Admin
- Manage users
- Configure evaluation metrics
- Manage tags

## ⚙️ Quick Start

1. Navigate to docker file:
   ```bash
   cd project-call-review-portal/call-review-portal/
   ```
2. Start Services

   ```bash
   docker-compose up 
   ```
3. if clickhouse port bind issue then use below command
     ```bash
     sudo systemctl stop clickhouse-server
     ```
4. Stop Services
      ``` bash
      docker-compose down
      ```

- The backend will be available at `http://localhost:8000`

- The frontend will be available at `http://localhost:5173`

- Admin Panel `http://localhost:8000/admin`

- Pgadmin `http://localhost:8080`
   

## Test Credentials

### Consultant User
- Username: `test`
- Password: `1234lkjh`

### Lead User
- Username: `kashvi`
- Password: `1234lkjh`
  
### Admin User
- Username: `admin`
- Password: `1234lkjh`

👉[Click here to view DEMO](https://drive.google.com/file/d/1dpNFCNPLG8_vG2oroqPy4CjuE0TmrrSf/view?usp=sharing) 
