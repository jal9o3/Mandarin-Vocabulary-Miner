# Mandarin Vocabulary Miner

Mandarin Vocabulary Miner is a tool designed to help learners of Mandarin Chinese analyze the frequency of words in a given text. Using Streamlit for the user interface, it also calculates how much of the text can be understood with a given set of vocabulary.

## Features

- **Text Parsing**: Enter Mandarin text and parse it to analyze word frequency.
- **Vocabulary Analysis**: Input your known vocabulary and calculate the percentage of the text you can understand.
- **Minimal Web UI**: Utilizes Streamlit to provide a minimal and straightforward user interface.

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/jal9o3/mandarin-vocabulary-miner.git
    cd mandarin-vocabulary-miner
    ```

2. Install the required dependencies:
    ```bash
    pip install -r requirements.txt
    ```

3. Run the Streamlit app:
    ```bash
    streamlit run app.py
    ```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or suggestions, please open an issue or contact me at jeromeardiente.loria@bicol-u.edu.ph

## Django REST-style API (hanlearn_backend)

The Streamlit analysis logic is now extracted into reusable backend services under `hanlearn_backend/miner_api/services.py` and exposed as JSON endpoints.

Run the backend:

```bash
cd hanlearn_backend
python manage.py runserver
```

Available endpoints:

- `POST /api/analyze`
    - JSON body: `{ "text": "...", "vocab_text": "optional words separated by spaces" }`
    - `vocab_text` is optional; if omitted, backend uses `hanlearn_backend/vocab.txt`.

- `POST /api/vocab-screen`
    - JSON body: `{ "text": "..." }`
    - Returns unique words grouped into `HSK 1` to `HSK 9` buckets so users can select known vocabulary before analysis.

- `POST /api/analyze-file`
    - `multipart/form-data`
    - file field: `file` (UTF-8 text file)
    - optional field: `vocab_text`

- `GET /api/vocab`
    - Returns persisted vocabulary and tokenized word list.

- `POST /api/vocab/update` or `PUT /api/vocab/update`
    - JSON body can be either:
        - `{ "vocab_text": "word1 word2 word3" }`
        - `{ "words": ["word1", "word2", "word3"] }`

Run backend API tests:

```bash
cd hanlearn_backend
python manage.py test miner_api
```