import string, re

import streamlit as st
import pandas as pd

import jieba
from pypinyin import pinyin, Style
from pyzhuyin import pinyin_to_zhuyin
from deep_translator import GoogleTranslator

from collections import Counter

# Set page configuration
st.set_page_config(page_title="Mandarin Vocabulary Miner")

# Hide the deploy button using custom CSS
hide_deploy_button = """
    <style>
    .stDeployButton {display: none;}
    </style>
"""
st.markdown(hide_deploy_button, unsafe_allow_html=True)

zh_punctuation = string.punctuation + '，。！？；：“”‘’（）【】《》   \n · 、 …'

def remove_punctuation(text):
    return text.translate(str.maketrans('', '', zh_punctuation))

def is_pinyin_toned(string):
    pattern = r'^[a-zA-Z]+[1234]$'
    return bool(re.match(pattern, string))

@st.cache_data
def translate_words(word_ranking):
    translation_bar = st.progress(0, text=f"Translating Word 0 of {len(word_ranking)}")
    word_translations = []
    for i, word in enumerate(word_ranking):
        translation_bar.progress(i/len(word_ranking), text=f"Translating Word {i} of {len(word_ranking)}")
        translated = GoogleTranslator(source='zh-CN', target='en').translate(word)
        word_translations.append(translated)
    translation_bar.progress(100, text=f"Translated {len(word_ranking)} words.")
    return word_translations

st.title("Mandarin Vocabulary Miner")

text = st.text_area('Enter Mandarin text here:', height=300)
cleaned_text = remove_punctuation(text)

# Write the text to the page (for hover dictionaries)
show_hoverable = st.checkbox("Write hoverable text")

if show_hoverable:
    st.write("You can use a pop-up dictionary of your choice on this text:")
    st.write(text)


pinyin_reading = st.checkbox("Write pinyin reading")
if pinyin_reading:
    raw_words = jieba.cut(text)
    raw_pinyin_text = ''
    for raw_word in raw_words:
        # Syllables are a list which are joined as a string
        raw_pinyin_text += "".join(syllable[0] for syllable in pinyin(raw_word, style=Style.TONE3)) + " "
    
    st.write(raw_pinyin_text)

zhuyin_reading = st.checkbox("Write zhuyin reading")
if zhuyin_reading:
    raw_words = jieba.cut(text)
    raw_zhuyin_text = ''
    for raw_word in raw_words:
        # Create a list of syllable strings
        syllables = [syllable[0] for syllable in pinyin(raw_word, style=Style.TONE3)]
        for syllable in syllables:
            try:
                # Add 5 if neutral tone
                if pinyin_to_zhuyin(syllable) and not is_pinyin_toned(syllable):
                    syllable += "5"
                    raw_zhuyin_text += pinyin_to_zhuyin(syllable)
                else:
                    raw_zhuyin_text += pinyin_to_zhuyin(syllable)
            except ValueError:
                raw_zhuyin_text += syllable
        raw_zhuyin_text += " "
    
    st.write(raw_zhuyin_text)

if cleaned_text:
    # Parse text
    words = jieba.cut(cleaned_text)
    # convert to normal python list
    word_list = list(words)

    # Sort words by frequency
    word_counter = Counter(word_list)
    word_ranking = [item for items, count in word_counter.most_common() for item in [items]]

    # Count occurences
    word_count = [count for items, count in word_counter.most_common()]
    
    # Calculate total percentage
    total_occurences = sum(word_count)
    word_percentages = [count/total_occurences*100 for count in word_count]

    # Get the pinyin
    word_pinyin = [pinyin(word, style=Style.TONE3) for word in word_ranking]

    # Get the zhuyin
    word_zhuyin = []
    for word in word_ranking:
        zhuyin_word = ''
        syllables = [syllable[0] for syllable in pinyin(word, style=Style.TONE3)]
        for syllable in syllables:
            try:
                if pinyin_to_zhuyin(syllable) and not is_pinyin_toned(syllable):
                        syllable += "5"
                        zhuyin_word += pinyin_to_zhuyin(syllable)
                else:
                    zhuyin_word += pinyin_to_zhuyin(syllable)
            except ValueError:
                zhuyin_word += syllable
        word_zhuyin.append(zhuyin_word)

    

    # Create a DataFrame
    df = pd.DataFrame(
        columns=("Word", "Pinyin", "%", "Occurences"),
    )

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
        vocab_text = st.text_area(
            'Enter the Mandarin words you can read (separated by spaces):', 
            value=vocab_text, height=200)
        if vocab_text:
            with open('vocab.txt', 'w') as file:
                # Write the vocabulary to the file
                file.write(vocab_text)
    
    show_pinyin = st.checkbox("Show Pinyin")
    show_zhuyin = st.checkbox("Show Zhuyin")
    show_known = st.checkbox ("Show Known Words")
    show_translations = st.checkbox("Show Machine Translations")

    vocab_list = vocab_text.split(" ")

    known = 0
    # Calculate the percentage of known words
    for word, count in word_counter.most_common():
        if word in vocab_list:
            known += count/total_occurences*100
    
    st.write(f"Text Analysis Result: You can read {known:.1f}% of the words in this text.")

    display_columns = ['Word', '%', 'Occurences']
    if show_pinyin:
        display_columns.append('Pinyin')
    else:
        if 'Pinyin' in display_columns:
            display_columns.remove('Pinyin')
    
    if show_zhuyin:
        display_columns.append('Zhuyin')
    else:
        if 'Zhuyin' in display_columns:
            display_columns.remove('Zhuyin')
    
    if show_translations:
        # Get machine translations
        word_translations = translate_words(word_ranking)
        print(word_translations)
        df['Translation'] = pd.Series(word_translations)
        print(df['Translation'])
        display_columns.append('Translation')
        print(display_columns)
    else:
        if 'Translation' in display_columns:
            display_columns.remove('Translation')

    df['Word'] = pd.Series(word_ranking)
    df['Occurences'] = pd.Series(word_count)
    df['%'] = pd.Series(word_percentages)
    df['Pinyin'] = pd.Series(word_pinyin)
    df['Zhuyin'] = pd.Series(word_zhuyin)

    # Create a filtered dataframe excluding known words
    filtered_df = df[~df['Word'].isin(vocab_list)]

    if show_known:
        display_df = df
    else:
        display_df = filtered_df

    # Display the DataFrame as an interactive table
    st.dataframe(display_df, column_order=display_columns, width=1000)

    # Writes the unknown words (for use with hover dictionaries)
    hoverable_vocab = st.checkbox("Write hoverable words")
    if hoverable_vocab:
        st.write("You can use a pop-up dictionary of your choice on these words:")
        words = ""
        for i, word in enumerate(display_df['Word']):
            words += f"#{i + 1} --> {word}"
            # Add a comma after every word except the last one
            if i != ((len(display_df['Word']) - 1)):
                words += ", "
            # Add a newline every three words
            if (i + 1) % 8 == 0:
                words += "\n"
                st.write(words)
                words = ""
            # Write the leftover words
            if i == (len(display_df['Word']) - 1):
                st.write(words)

