import boto3
from django.conf import settings
import tempfile

s3 = boto3.client(
    "s3",
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
)

def download_s3_file(bucket, key):
    tmp_file = tempfile.NamedTemporaryFile(delete=False)
    s3.download_file(bucket, key, tmp_file.name)
    return tmp_file.name