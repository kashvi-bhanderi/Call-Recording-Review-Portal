from google_auth_oauthlib.flow import InstalledAppFlow
import pickle

SCOPES = ['https://www.googleapis.com/auth/drive.file']

flow = InstalledAppFlow.from_client_secrets_file(
    'client_secret.json',
    SCOPES,
    redirect_uri='urn:ietf:wg:oauth:2.0:oob'  # ✅ IMPORTANT FIX
)

# Step 1: Generate auth URL
auth_url, _ = flow.authorization_url(prompt='consent')

print("\n👉 Open this URL in your browser:\n")
print(auth_url)

# Step 2: Get code from user
code = input("\n👉 Paste the authorization code here: ")

# Step 3: Exchange code for token
flow.fetch_token(code=code)

creds = flow.credentials

# Step 4: Save token
with open('token.pickle', 'wb') as token:
    pickle.dump(creds, token)

print("\n✅ Token saved successfully!")