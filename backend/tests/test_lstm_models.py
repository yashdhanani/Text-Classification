import pytest
import torch
from app.ml.models.lstm import LSTMClassifier, BiLSTMClassifier, CNNLSTMClassifier, build_lstm_model


def test_lstm_forward_pass():
    vocab_size = 500
    num_classes = 3
    batch_size = 4
    seq_len = 20
    
    model = LSTMClassifier(vocab_size=vocab_size, embed_dim=32, hidden_dim=64, num_classes=num_classes)
    x = torch.randint(0, vocab_size, (batch_size, seq_len))
    logits = model(x)
    
    assert logits.shape == (batch_size, num_classes)


def test_bilstm_with_attention_forward_pass():
    vocab_size = 500
    num_classes = 4
    batch_size = 2
    seq_len = 15
    
    model = BiLSTMClassifier(vocab_size=vocab_size, embed_dim=32, hidden_dim=64, num_classes=num_classes, use_attention=True)
    x = torch.randint(0, vocab_size, (batch_size, seq_len))
    logits = model(x)
    
    assert logits.shape == (batch_size, num_classes)
    
    # Test attention weights extraction
    attn_weights = model.get_attention_weights(x)
    assert attn_weights.shape == (batch_size, seq_len)


def test_cnn_lstm_forward_pass():
    vocab_size = 500
    num_classes = 2
    batch_size = 4
    seq_len = 30
    
    model = CNNLSTMClassifier(vocab_size=vocab_size, embed_dim=32, num_filters=32, hidden_dim=64, num_classes=num_classes)
    x = torch.randint(0, vocab_size, (batch_size, seq_len))
    logits = model(x)
    
    assert logits.shape == (batch_size, num_classes)


def test_model_factory():
    for arch in ["lstm", "bilstm", "cnn_lstm"]:
        model = build_lstm_model(arch, vocab_size=100, num_classes=3, config={})
        assert isinstance(model, torch.nn.Module)
