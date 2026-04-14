from googleapiclient.http import MediaFileUpload
from django.conf import settings
from .drive_service import get_drive_service

def upload_file_to_drive(file_path, filename):
    service = get_drive_service()

    file_metadata = {
        'name': filename,
        'parents': [settings.GOOGLE_DRIVE_FOLDER_ID]
    }

    media = MediaFileUpload(file_path, resumable=True)

    file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id'
    ).execute()

    return file.get('id')