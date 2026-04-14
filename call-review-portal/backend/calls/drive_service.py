import pickle
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_drive_service():
    with open('token.pickle', 'rb') as token:
        creds = pickle.load(token)

    service = build('drive', 'v3', credentials=creds)
    return service