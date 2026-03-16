import boto3
from django.conf import settings


def get_s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


def find_audio_file(bucket_name, prefix):
    """
    Find first .wav file inside given prefix.
    """
    s3 = get_s3_client()

    response = s3.list_objects_v2(
        Bucket=bucket_name,
        Prefix=prefix
    )

    contents = response.get("Contents", [])

    for obj in contents:
        key = obj["Key"]
        if key.lower().endswith(".wav"):
            return key

    return None


def generate_signed_url(bucket_name, key, expires_in=300):
    """
    Generate temporary signed URL for secure audio access.
    """
    s3 = get_s3_client()

    return s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket_name,
            "Key": key
        },
        ExpiresIn=expires_in
    )