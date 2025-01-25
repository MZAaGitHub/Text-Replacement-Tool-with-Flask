import os
import re
import fitz
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_pymongo import PyMongo
from bson.objectid import ObjectId
from functools import wraps

app = Flask(__name__)
CORS(app)

# MongoDB Configuration
app.config['MONGO_URI'] = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/Replacement')
mongo = PyMongo(app)


def handle_errors(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            app.logger.error(f"Error in {func.__name__}: {str(e)}")
            return jsonify({
                'message': 'An unexpected error occurred',
                'error': str(e) if os.getenv('FLASK_ENV') != 'production' else ''
            }), 500
    return wrapper


def adjust_indices(collection, target_index, increment):
    collection.update_many(
        {'index': {'$gt': target_index}},
        {'$inc': {'index': increment}}
    )


def insert_newline_after_chapters(text):
    pattern = r'^(.*?(บทที่|ตอนที่)\s*\d+(\.\d+)?.*?)$'

    lines = text.split('\n')
    result = []

    for line in lines:
        if re.match(pattern, line):
            result.append(line + "New-Line")
        else:
            result.append(line)

    return '\n'.join(result)


@app.route('/api/replacements', methods=['GET'])
@handle_errors
def get_replacements():
    replacements = list(mongo.db.replacements.find().sort('index'))
    for replacement in replacements:
        replacement['_id'] = str(replacement['_id'])
    return jsonify(replacements)


@app.route('/api/replacements', methods=['POST'])
@handle_errors
def add_replacement():
    data = request.json
    reference_index = data.get('index', 0)

    adjust_indices(mongo.db.replacements, reference_index, 1)

    new_replacement = {**data, 'index': reference_index + 1}
    result = mongo.db.replacements.insert_one(new_replacement)

    new_replacement['_id'] = str(result.inserted_id)
    return jsonify(new_replacement), 201


@app.route('/api/replacements/<replacement_id>', methods=['PATCH'])
@handle_errors
def update_replacement(replacement_id):
    data = request.json
    result = mongo.db.replacements.find_one_and_update(
        {'_id': ObjectId(replacement_id)},
        {'$set': data},
        return_document=True
    )

    if not result:
        return jsonify({'message': 'Replacement not found'}), 404

    result['_id'] = str(result['_id'])
    return jsonify(result)


@app.route('/api/replacements/<replacement_id>', methods=['DELETE'])
@handle_errors
def delete_replacement(replacement_id):
    deleted_replacement = mongo.db.replacements.find_one_and_delete({
        '_id': ObjectId(replacement_id)
    })

    if not deleted_replacement:
        return jsonify({'message': 'Replacement not found'}), 404

    adjust_indices(mongo.db.replacements, deleted_replacement['index'], -1)

    return jsonify({
        'message': 'Replacement deleted',
        'deletedId': replacement_id
    })


@app.route('/api/replacements/upload', methods=['POST'])
@handle_errors
def upload_pdf():
    if 'pdf' not in request.files:
        return jsonify({'error': 'No PDF file provided'}), 400

    pdf_file = request.files['pdf']
    if not pdf_file.filename.endswith('.pdf'):
        return jsonify({'error': 'Invalid file type'}), 400

    doc = fitz.open(stream=pdf_file.read(), filetype="pdf")
    text = " ".join(page.get_text() for page in doc)

    text = insert_newline_after_chapters(text)

    word_replace = [
        ["บทที่ ", "bottee "],
        ["ตอนที่ ", "tontee "],
        [" \nhttps://novel-lk.com/ \n", ""],
        [" \n", "newline"],
        ["\n", ""],
        ["newline", "\n"],
        ["ํา", "า"],
        [" ้า", "้ำ"],
        [" ่า", "่ำ"],
        ["ห ล", "หล"],
        ["ห ย", "หย"],
        [" า", "ำ"],
        [" ้า", "้ำ"],
        ["่ ", "่"],
        [" ่", "่"],
        ["้ ", "้"],
        [" ้", "้"],
        ["๊ ", "๊"],
        [" ๊", "๊"],
        ["๋ ", "๋"],
        [" ๋", "๋"],
        [" ็", "็"],
        ["็ ", "็"],
        [" ิ", "ิ"],
        ["ิ ", "ิ"],
        [" ี", "ี"],
        ["ี ", "ี"],
        [" ึ", "ึ"],
        ["ึ ", "ึ"],
        [" ื", "ื"],
        ["ื ", "ื"],
        [" ์", "์"],
        ["bottee ", "\nบทที่ "],
        ["tontee ", "\nตอนที่ "],
        ["New-Line", "\n\n"]
    ]

    for old_word, new_word in word_replace:
        text = text.replace(old_word, new_word)

    return jsonify({'text': text.strip()})


@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') != 'production')
