import pytest
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    generate_api_key,
    hash_api_key,
)


def test_password_hashing():
    pw = "SuperSecurePassword123!"
    hashed = hash_password(pw)
    
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_generation_and_decoding():
    user_id = "123e4567-e89b-12d3-a456-426614174000"
    token = create_access_token(user_id, extra_claims={"role": "admin"})
    
    decoded = decode_token(token)
    assert decoded["sub"] == user_id
    assert decoded["role"] == "admin"
    assert decoded["type"] == "access"


def test_api_key_generation_and_hashing():
    raw_key, hashed = generate_api_key()
    
    assert raw_key.startswith("nt_live_")
    assert len(raw_key) > 30
    assert hash_api_key(raw_key) == hashed
