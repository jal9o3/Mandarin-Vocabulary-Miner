import streamlit as st

st.title("Mandarin Chapter Reader")

chapter = st.text_area('Enter content here:', height=300)

# Display the entered text
st.write('You entered:')
st.write(chapter)