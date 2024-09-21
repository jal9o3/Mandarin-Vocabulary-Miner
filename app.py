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
    # Display the entered text
    # st.write('Text:')
    # st.write(chapter)

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

    show_pinyin = st.checkbox("Show Pinyin")

    # Display the DataFrame as an interactive table
    if show_pinyin:
        st.dataframe(df, width=600)
    else:
        st.dataframe(df, column_order=['Word', '%', 'Occurences'], width=600)