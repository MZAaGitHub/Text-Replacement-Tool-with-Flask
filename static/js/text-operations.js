class TextOperations {
    constructor() {
        this.textarea = document.getElementById('mainText');
        this.pdfInput = document.getElementById('pdfInput');
        this.lineLimit = document.getElementById('lineLimit');
        this.originalText = document.getElementById('originalText');
        this.replacementText = document.getElementById('replacementText');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.querySelectorAll('.btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (this[action]) {
                    this[action]();
                }
            });
        });
        // PDF file input change handler
        this.pdfInput.addEventListener('change', (e) => this.handlePdfUpload(e));
    }

    async paste() {
        try {
            const text = await navigator.clipboard.readText();
            this.textarea.value += text;
        } catch (err) {
            console.error('Failed to paste:', err);
        }
    }

    async copy() {
        this.textarea.select();
        await navigator.clipboard.writeText(this.textarea.value);
    }

    clear() {
        this.textarea.value = '';
    }

    download() {
        const text = this.textarea.value
        if (!text.trim()) {
            alert("The text area is empty. Cannot download an empty file.");
            return;
        }

        const firstLine = text.split('\n')[0].trim();
        const fileName = firstLine.slice(0, 50);
        const safeFileName = fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFileName + '.txt' || 'download.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async replace() {
        const replacements = await TableManager.fetchReplacements();
        let text = this.textarea.value;

        replacements.forEach(({ original, replacement }) => {
            const regex = new RegExp(this.escapeRegExp(original), 'g');
            text = text.replace(regex, replacement);
        });

        this.textarea.value = text.trim();
    }

    async replaceText() {
        let text = this.textarea.value;
        let original = this.originalText.value;
        let replacement = this.replacementText.value;

        const regex = new RegExp(this.escapeRegExp(original), 'g');
        text = text.replace(regex, replacement);
        this.textarea.value = text;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    'toggle-table'() {
        const content = document.querySelector('.content');
        const textSection = document.querySelector('.text-section');
        const replaceSection = document.querySelector('.replace-section');
        const tableIcon = document.querySelector('.table-icon');
        const hideTableIcon = document.querySelector('.hide-table-icon');

        textSection.classList.toggle('fullscreen');
        replaceSection.classList.toggle('hidden');
        content.classList.toggle('with-table');

        if (!replaceSection.classList.contains('hidden')) {
            tableIcon.style.display = 'none';
            hideTableIcon.style.display = 'block';
        } else {
            tableIcon.style.display = 'block';
            hideTableIcon.style.display = 'none';
        }
    }

    async readPdf() {
        this.pdfInput.click();
    }

    async handlePdfUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append('pdf', file);

            const response = await fetch('/api/replacements/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.textarea.value = data.text;

        } catch (error) {
            console.error('Error reading PDF:', error);
            alert('Error reading PDF file. Please try again.');
        }

        this.pdfInput.value = '';
    }

    adjustLines() {
        const limit = parseInt(this.lineLimit.value);
        if (limit < 1) {
            alert('Please enter a valid line limit (minimum 1)');
            return;
        }

        let word_replace = [
            ["“", "\n\n“"],
            ["”", "”\n\n"],
        ];

        for (let [old_word, new_word] of word_replace) {
            const regex = new RegExp(this.escapeRegExp(old_word), 'g');
            this.textarea.value = this.textarea.value.replace(regex, new_word);
        }

        const lines = this.textarea.value.split('\n');
        const adjustedLines = [];
        let currentLine = '';

        for (const line of lines) {
            if (!line.trim()) {
                if (currentLine) {
                    adjustedLines.push(currentLine);
                    currentLine = '';
                }
                adjustedLines.push('');
                continue;
            }

            const words = line.trim().split(' ');

            for (const word of words) {
                if (!currentLine) {
                    currentLine = word;
                } else {
                    const testLine = currentLine + ' ' + word;
                    if (testLine.length <= limit) {
                        currentLine = testLine;
                    } else {
                        adjustedLines.push(currentLine);
                        currentLine = word;
                    }
                }
            }

            if (currentLine) {
                adjustedLines.push(currentLine);
                currentLine = '';
            }
        }

        if (currentLine) {
            adjustedLines.push(currentLine);
        }

        this.textarea.value = adjustedLines.join('\n');

        let line_replace = [
            ["\n\n\n", "\n"],
            ["\n\n", "\n"],
            ["\n", "\n\n"],
        ];

        for (let [old_word, new_word] of line_replace) {
            const regex = new RegExp(this.escapeRegExp(old_word), 'g');
            this.textarea.value = this.textarea.value.replace(regex, new_word);
        }
    }

}

// Initialize text operations
const textOps = new TextOperations();

