import pytest
from app.ml.preprocessing.text_cleaner import PreprocessingConfig, TextPreprocessor
from app.ml.preprocessing.tokenizer import LSTMTokenizer


def test_text_cleaner_for_lstm():
    config = PreprocessingConfig.for_lstm()
    preprocessor = TextPreprocessor(config)
    
    dirty = "Check this out https://neuraltext.ai <br/> awesome product! #AI @user"
    clean = preprocessor.clean(dirty)
    
    assert "https" not in clean
    assert "<br/>" not in clean
    assert "awesome" in clean


def test_tokenizer_fit_transform():
    texts = [
        "this is the first sample",
        "another great sample for classification",
        "neural networks and deep learning",
    ]
    
    tokenizer = LSTMTokenizer(max_vocab_size=100, min_freq=1, max_length=10)
    sequences = tokenizer.fit_transform(texts)
    
    assert sequences.shape == (3, 10)
    assert tokenizer.vocab_size > 5
    
    # Test out-of-vocabulary word mapping to UNK (index 1)
    new_text = ["completely unknown phrase"]
    transformed = tokenizer.transform(new_text)
    assert transformed.shape == (1, 10)
