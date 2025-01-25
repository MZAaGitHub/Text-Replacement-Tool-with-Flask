class TableManager {
    static contextMenu = null;
    static BASE_URL = '/api/replacements';

    static async request(url, method = 'GET', body = null) {
        try {
            const options = {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : {},
                body: body ? JSON.stringify(body) : null
            };
            const response = await fetch(url, options);
            return response.ok ? await response.json() : null;
        } catch (error) {
            console.error(`Error in ${method} request:`, error);
            return null;
        }
    }

    static async fetchReplacements() {
        const data = await this.request(this.BASE_URL);
        if (data) this.updateTable(data);
        return data || [];
    }

    static updateTable(replacements) {
        document.querySelector('#replacementTable tbody').innerHTML = replacements.map(item => `
            <tr data-index="${item.index}" data-id="${item._id}">
                <td ondblclick="TableManager.editCell(this, 'original')">${item.original}</td>
                <td ondblclick="TableManager.editCell(this, 'replacement')">${item.replacement}</td>
            </tr>
        `).join('');
    }

    static editCell(cell, field) {
        const originalText = cell.textContent;
        const textarea = document.createElement('textarea');
        textarea.value = originalText;
        textarea.className = 'cell-editor';
    
        cell.textContent = '';
        cell.appendChild(textarea);
        textarea.focus();

        const saveChanges = async () => {
            const newText = textarea.value;
            if (!newText) {
                cell.textContent = originalText;
                return;
            }

            const rowId = cell.closest('tr').getAttribute('data-id');
            const result = await this.request(`${this.BASE_URL}/${rowId}`, 'PATCH', { [field]: newText });
            
            cell.textContent = result ? newText : originalText;
        };

        textarea.addEventListener('blur', saveChanges);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                saveChanges();
            }
        });
    }

    static removeContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    static async addReplacement(referenceIndex) {
        const newReplacement = {
            original: 'New Original',
            replacement: '',
            index: referenceIndex
        };

        const result = await this.request(this.BASE_URL, 'POST', newReplacement);
        if (result) this.fetchReplacements();
    }

    static async deleteReplacement(rowId) {
        const result = await this.request(`${this.BASE_URL}/${rowId}`, 'DELETE');
        if (result) document.querySelector(`tr[data-id="${rowId}"]`)?.remove();
    }

    static initializeContextMenu() {
        const table = document.getElementById('replacementTable');

        table.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const targetRow = e.target.closest('tr');
            if (!targetRow) return;

            this.removeContextMenu();
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.left = `${e.pageX}px`;
            menu.style.top = `${e.pageY}px`;

            const addOption = this.createMenuOption('Add Row', () => {
                this.addReplacement(parseInt(targetRow.getAttribute('data-index'), 10));
                this.removeContextMenu();
            });

            const deleteOption = this.createMenuOption('Delete Row', () => {
                this.deleteReplacement(targetRow.getAttribute('data-id'));
                this.removeContextMenu();
            });

            addOption.className = 'menu-option add-option';
            deleteOption.className = 'menu-option delete-option';

            menu.append(addOption, deleteOption);
            document.body.appendChild(menu);
            this.contextMenu = menu;
        });

        document.addEventListener('click', () => this.removeContextMenu());
        document.addEventListener('scroll', () => this.removeContextMenu());
    }

    static createMenuOption(text, onClick) {
        const option = document.createElement('div');
        option.className = `menu-option ${text.toLowerCase().replace(' ', '-')}-option`;
        option.textContent = text;
        option.onclick = onClick;
        return option;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    TableManager.fetchReplacements();
    TableManager.initializeContextMenu();
});