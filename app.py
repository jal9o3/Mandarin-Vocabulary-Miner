import string

import streamlit as st
import pandas as pd

import jieba
from pypinyin import lazy_pinyin, Style

from collections import Counter

zh_punctuation = string.punctuation + '，。！？；：“”‘’（）【】《》 '

def remove_punctuation(text):
    return text.translate(str.maketrans('', '', zh_punctuation))

st.title("Mandarin Chapter Reader")

chapter = st.text_area('Enter content here:', height=300)
chapter = remove_punctuation(chapter)

if chapter:
    # Display the entered text
    st.write('Text:')
    st.write(chapter)

    # Parse text
    words = jieba.cut(chapter)
    # convert to normal python list
    word_list = list(words)

    # Sort words by frequency
    word_counter = Counter(word_list)
    word_ranking = [item for items, count in word_counter.most_common() for item in [items]]
    word_count = [count for items, count in word_counter.most_common()]
    # word_ranking_unique = [word_ranking_unique.append(x) for x in word_ranking if x not in word_ranking_unique]

    # Count frequency

    # Calculate total percentage

    # Remove duplicates

    # Get the pinyin
    pinyin_pairs = dict()
    for word in word_list:
        pinyin_pairs[word] = lazy_pinyin(word, style=Style.TONE3)[0]


    # Create a sample DataFrame
    df = pd.DataFrame(
        columns=("Word", "Pinyin", "Frequency", "Occurences")
    )

    df['Word'] = pd.Series(word_ranking)
    df['Occurences'] = pd.Series(word_count)
    # Display the DataFrame as an interactive table
    st.dataframe(df)