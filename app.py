import string

import streamlit as st
import pandas as pd

import jieba
from pypinyin import pinyin, lazy_pinyin, Style

from collections import Counter

zh_punctuation = string.punctuation + '，。！？；：“”‘’（）【】《》   \n ·'

def remove_punctuation(text):
    return text.translate(str.maketrans('', '', zh_punctuation))

st.title("Mandarin Chapter Reader")

chapter = st.text_area('Enter content here:', height=300)
chapter = remove_punctuation(chapter)

if chapter:
    # Parse text
    words = jieba.cut(chapter)
    # convert to normal python list
    word_list = list(words)

    # Sort words by frequency
    word_counter = Counter(word_list)
    word_ranking = [item for items, count in word_counter.most_common() for item in [items]]

    # Count occurences
    word_count = [count for items, count in word_counter.most_common()]
    
    # Calculate total percentage
    total_frequency = sum(word_count)
    word_percentages = [count/total_frequency*100 for count in word_count]

    # Get the pinyin
    word_pinyin = [pinyin(word, style=Style.TONE3) for word in word_ranking]


    # Create a sample DataFrame
    df = pd.DataFrame(
        columns=("Word", "Pinyin", "%", "Occurences"),
    )

    df['Word'] = pd.Series(word_ranking)
    df['Occurences'] = pd.Series(word_count)
    df['%'] = pd.Series(word_percentages)
    df['Pinyin'] = pd.Series(word_pinyin)

    # Load vocabulary file
    try:
            with open('vocab.txt', 'r') as file:
                # Read the contents of the file into a variable
                vocab_text = file.read()
    except FileNotFoundError:
        with open('vocab.txt', 'w') as file:
            # Create empty file
            pass
    finally:
        with open('vocab.txt', 'r') as file:
            # Read the contents of the file into a variable
            vocab_text = file.read()
    
    edit_vocab = st.checkbox("Vocabulary Edit Mode")
    if edit_vocab:
        # Load the vocab into a text area for editing
        vocab_text = st.text_area('Enter known words (separated by spaces):', value=vocab_text, height=200)
        if vocab_text:
            with open('vocab.txt', 'w') as file:
                # Write the vocabulary to the file
                file.write(vocab_text)
    
    show_pinyin = st.checkbox("Show Pinyin")
    show_known = st.checkbox ("Show Known Words")


    vocab_list = vocab_text.split(" ")
    # Create a filtered dataframe excluding known words
    filtered_df = df[~df['Word'].isin(vocab_list)]

    if show_known:
        display_df = df
    else:
        display_df = filtered_df

    # Display the DataFrame as an interactive table
    if show_pinyin:
        st.dataframe(display_df, width=1000)
    else:
        st.dataframe(display_df, column_order=['Word', '%', 'Occurences'], width=600)